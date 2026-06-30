(function () {
    const JSPDF_LOCAL = '/assets/vendor/jspdf.umd.min.js';
    const JSPDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    const PRINT_COLORS = {
        brand: [44, 62, 80],
        brandDark: [31, 41, 55],
        accent: [39, 174, 96],
        text: [17, 24, 39],
        muted: [107, 114, 128],
        border: [214, 221, 232],
        soft: [248, 250, 252],
        stripe: [252, 253, 255]
    };

    function sanitizeFileName(value) {
        return String(value || 'pedido')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9._-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 80) || 'pedido';
    }

    function text(value, fallback = '-') {
        const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
        return normalized || fallback;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function normalizeCompany(company = {}) {
        const cityState = [company.cidade || company.city, company.estado || company.state || company.uf]
            .filter(Boolean)
            .join(' - ');
        const logo = String(
            company.logoDataUrl
            || company.logoDataURL
            || company.logo
            || company.logoUrl
            || company.logoURL
            || company.logoDownloadURL
            || company.logoBase64
            || ''
        ).trim();
        const logoStoragePath = String(
            company.logoStoragePath
            || company.logoPath
            || company.storagePath
            || company.logoRef
            || ''
        ).trim();
        return {
            name: text(company.nome || company.name || company.razaoSocial || 'Sisweb'),
            logo,
            logoStoragePath,
            lines: [
                company.cnpj ? `CNPJ: ${company.cnpj}` : '',
                company.endereco || company.address || '',
                cityState,
                company.telefone || company.phone ? `Fone: ${company.telefone || company.phone}` : '',
                company.email ? `Email: ${company.email}` : ''
            ].filter(Boolean).map((line) => text(line, ''))
        };
    }

    function getInitials(value) {
        const words = text(value, 'SW')
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2);
        return (words.map((word) => word.charAt(0)).join('') || 'SW').toUpperCase();
    }

    function buildLogoHtml(company) {
        const normalized = normalizeCompany(company);
        if (normalized.logo) {
            return `<img src="${escapeHtml(normalized.logo)}" alt="Logo da empresa">`;
        }
        return `<div class="sisweb-print-logo-mark">${escapeHtml(getInitials(normalized.name))}</div>`;
    }

    function buildPrintHeader(options = {}) {
        const company = normalizeCompany(options.company || {});
        const metaRows = Array.isArray(options.metaRows) ? options.metaRows.filter(Boolean) : [];
        const subtitle = options.subtitle ? `<div class="sisweb-print-subtitle">${escapeHtml(options.subtitle)}</div>` : '';
        const badgeText = options.badgeText || options.documentLabel || 'Sisweb';
        const documentNumber = options.documentNumber ? `<div class="sisweb-print-doc-number">#${escapeHtml(options.documentNumber)}</div>` : '';
        return `
            <header class="sisweb-print-header">
                <div class="sisweb-print-logo">${buildLogoHtml(options.company || {})}</div>
                <div class="sisweb-print-company">
                    <div class="sisweb-print-company-name">${escapeHtml(company.name)}</div>
                    ${company.lines.map((line) => `<div class="sisweb-print-company-line">${escapeHtml(line)}</div>`).join('')}
                </div>
                <div class="sisweb-print-meta">
                    <div class="sisweb-print-badge">${escapeHtml(badgeText)}</div>
                    <div class="sisweb-print-title">${escapeHtml(options.title || 'Relatorio')}</div>
                    ${documentNumber}
                    ${subtitle}
                    ${metaRows.map((row) => `<div class="sisweb-print-meta-line">${escapeHtml(row)}</div>`).join('')}
                </div>
            </header>
        `;
    }

    function isPdfImageDataUrl(value) {
        return /^data:image\/(png|jpe?g|webp);base64,/i.test(String(value || '').trim());
    }

    function getDataUrlImageType(value) {
        const match = String(value || '').match(/^data:image\/(png|jpe?g|webp);base64,/i);
        if (!match) return '';
        if (/jpe?g/i.test(match[1])) return 'JPEG';
        if (/webp/i.test(match[1])) return 'WEBP';
        return 'PNG';
    }

    function readBlobAsDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('Falha ao converter logo para DataURL.'));
            reader.readAsDataURL(blob);
        });
    }

    function extractFirebaseStoragePathFromUrl(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (/^gs:\/\//i.test(raw)) {
            return raw.replace(/^gs:\/\/[^/]+\//i, '').replace(/^\/+/, '');
        }
        if (!/^https?:\/\//i.test(raw)) return '';
        try {
            const url = new URL(raw, window.location && window.location.origin ? window.location.origin : undefined);
            const host = String(url.hostname || '').toLowerCase();
            const isStorageHost = host.includes('firebasestorage.googleapis.com') || host.endsWith('.firebasestorage.app');
            if (!isStorageHost) return '';
            const marker = '/o/';
            const index = url.pathname.indexOf(marker);
            if (index < 0) return '';
            return decodeURIComponent(url.pathname.slice(index + marker.length)).replace(/^\/+/, '');
        } catch (_) {
            return '';
        }
    }

    function isFirebaseStorageHttpUrl(value) {
        return !!extractFirebaseStoragePathFromUrl(value) && /^https?:\/\//i.test(String(value || '').trim());
    }

    function uniqueValues(values) {
        const seen = new Set();
        return values
            .map((value) => String(value || '').trim())
            .filter((value) => {
                if (!value || seen.has(value)) return false;
                seen.add(value);
                return true;
            });
    }

    async function fetchLogoAsDataUrl(source, maxBytes = 2 * 1024 * 1024) {
        const raw = String(source || '').trim();
        if (!raw) return '';
        const response = await fetch(raw, /^https?:\/\//i.test(raw) ? { mode: 'cors' } : undefined);
        if (!response.ok) throw new Error(`Falha ao baixar logo (${response.status}).`);
        const blob = await response.blob();
        if (!String(blob.type || '').startsWith('image/')) throw new Error('Logo da empresa não é uma imagem.');
        if (Number(blob.size || 0) > maxBytes) throw new Error('Logo da empresa excede 2MB.');
        const dataUrl = await readBlobAsDataUrl(blob);
        return isPdfImageDataUrl(dataUrl) ? dataUrl : '';
    }

    function withTimeout(promise, timeoutMs, label = 'Operação') {
        const safeTimeout = Number(timeoutMs || 0);
        if (!safeTimeout || safeTimeout < 1) return promise;
        if (typeof setTimeout !== 'function') return promise;
        return Promise.race([
            promise,
            new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`${label} excedeu ${safeTimeout}ms.`)), safeTimeout);
            })
        ]);
    }

    async function resolveCompanyLogoDataUrl(company = {}, options = {}) {
        const normalized = normalizeCompany(company);
        const logoSource = normalized.logo;
        if (isPdfImageDataUrl(logoSource)) return logoSource;
        const timeoutMs = Number(options.timeoutMs || 6000);

        const storageCandidates = uniqueValues([
            normalized.logoStoragePath,
            extractFirebaseStoragePathFromUrl(logoSource),
            !/^(https?:|data:|blob:|file:)/i.test(String(logoSource || '')) ? logoSource : ''
        ]);
        const urlCandidates = uniqueValues([
            /^https?:\/\//i.test(String(logoSource || '')) ? logoSource : ''
        ]);
        if (!storageCandidates.length && !urlCandidates.length) return '';

        const services = [
            window.firebaseService,
            window.firebaseServiceTL,
            window.FirebaseService,
            window.SiswebStorage
        ].filter(Boolean);

        const getters = [];
        services.forEach((service) => {
            if (!service) return;
            if (typeof service.getStorageDataURL === 'function') {
                getters.push({ owner: service, getter: service.getStorageDataURL });
            }
            if (typeof service.getDataURL === 'function') {
                getters.push({ owner: service, getter: service.getDataURL });
            }
            if (service.storage && typeof service.storage.getDataURL === 'function') {
                getters.push({ owner: service.storage, getter: service.storage.getDataURL });
            }
        });

        for (const { owner, getter } of getters) {
            for (const candidate of storageCandidates) {
                try {
                    const dataUrl = await withTimeout(
                        getter.call(owner, candidate, 2 * 1024 * 1024),
                        timeoutMs,
                        'Logo da empresa'
                    );
                    if (isPdfImageDataUrl(dataUrl)) return dataUrl;
                } catch (error) {
                    console.warn('Logo da empresa indisponível para PDF via Storage:', error);
                }
            }
        }

        for (const candidate of urlCandidates) {
            if (isFirebaseStorageHttpUrl(candidate)) continue;
            try {
                return await withTimeout(
                    fetchLogoAsDataUrl(candidate),
                    timeoutMs,
                    'Logo da empresa'
                );
            } catch (error) {
                console.warn('Logo da empresa indisponível para PDF via URL:', error);
            }
        }
        return '';
    }

    async function preparePdfOptions(options = {}) {
        const company = { ...(options.company || {}) };
        const logoDataUrl = await resolveCompanyLogoDataUrl(company);
        if (logoDataUrl) {
            company.logo = logoDataUrl;
            company.logoDataUrl = logoDataUrl;
            company.logoUrl = logoDataUrl;
            company.logoSvg = false;
        }
        return { ...options, company };
    }

    async function preparePrintOptions(options = {}) {
        const safeOptions = options || {};
        const company = { ...(safeOptions.company || {}) };
        const logoDataUrl = await resolveCompanyLogoDataUrl(company, {
            timeoutMs: safeOptions.logoTimeoutMs || 6000
        });
        if (logoDataUrl) {
            company.logo = logoDataUrl;
            company.logoDataUrl = logoDataUrl;
            company.logoUrl = logoDataUrl;
            company.logoSvg = false;
        }
        return { ...safeOptions, company };
    }

    function getPrintStyles(extraCss = '') {
        return `
            @page {
                size: A4;
                margin: 10mm;
            }

            * {
                box-sizing: border-box;
            }

            html,
            body {
                margin: 0;
                background: #fff;
                color: #111827;
                font-family: "Segoe UI", Arial, sans-serif;
                font-size: 11px;
                line-height: 1.35;
            }

            body.sisweb-commerce-print {
                padding: 18px;
            }

            .sisweb-print-page {
                width: 100%;
                max-width: 190mm;
                margin: 0 auto;
            }

            .sisweb-print-page.compact {
                font-size: 10px;
            }

            .sisweb-print-header {
                display: grid;
                grid-template-columns: 92px minmax(0, 1fr) 190px;
                gap: 14px;
                align-items: center;
                padding: 12px 14px;
                margin-bottom: 16px;
                border: 1px solid #d6dde8;
                border-top: 5px solid #2c3e50;
                border-radius: 6px;
                background: #ffffff;
                break-inside: avoid;
            }

            .sisweb-print-logo {
                width: 82px;
                height: 74px;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 1px solid #e2e8f0;
                border-radius: 6px;
                background: #f8fafc;
                overflow: hidden;
            }

            .sisweb-print-logo img {
                max-width: 76px;
                max-height: 68px;
                object-fit: contain;
            }

            .sisweb-print-logo-mark {
                width: 56px;
                height: 56px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                background: #2c3e50;
                color: #fff;
                font-weight: 800;
                font-size: 18px;
                letter-spacing: 0;
            }

            .sisweb-print-company {
                min-width: 0;
            }

            .sisweb-print-company-name {
                color: #1f2937;
                font-size: 16px;
                font-weight: 800;
                line-height: 1.15;
                margin-bottom: 5px;
                text-transform: uppercase;
            }

            .sisweb-print-company-line,
            .sisweb-print-meta-line,
            .sisweb-print-subtitle,
            .sisweb-print-doc-number {
                color: #4b5563;
                font-size: 10.5px;
                line-height: 1.35;
                overflow-wrap: anywhere;
            }

            .sisweb-print-meta {
                text-align: right;
                align-self: stretch;
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                justify-content: center;
                gap: 3px;
            }

            .sisweb-print-badge {
                display: inline-block;
                padding: 3px 7px;
                border-radius: 4px;
                background: #e9f7ef;
                color: #176a3a;
                font-size: 9px;
                font-weight: 800;
                letter-spacing: 0;
                text-transform: uppercase;
            }

            .sisweb-print-title {
                color: #1f2937;
                font-size: 15px;
                font-weight: 800;
                line-height: 1.15;
            }

            .sisweb-print-section {
                margin: 0 0 14px;
                break-inside: avoid;
            }

            .sisweb-print-section-title {
                margin: 0 0 8px;
                padding-bottom: 5px;
                border-bottom: 2px solid #2c3e50;
                color: #1f2937;
                font-size: 12px;
                font-weight: 800;
                text-transform: uppercase;
            }

            .sisweb-print-info-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 12px;
                margin-bottom: 14px;
            }

            .sisweb-print-info-box,
            .summary-box,
            .sisweb-print-totals {
                border: 1px solid #d6dde8;
                border-radius: 6px;
                background: #f8fafc;
                padding: 10px 12px;
                break-inside: avoid;
            }

            .sisweb-print-info-box h3,
            .sisweb-print-info-box h4 {
                margin: 0 0 8px;
                color: #2c3e50;
                font-size: 11px;
                font-weight: 800;
                text-transform: uppercase;
            }

            .sisweb-print-info-box p {
                margin: 4px 0;
            }

            .sisweb-print-table,
            table {
                width: 100%;
                border-collapse: collapse;
                margin: 0 0 12px;
                table-layout: fixed;
            }

            .sisweb-print-table th,
            .sisweb-print-table td,
            table th,
            table td {
                border: 1px solid #d6dde8;
                padding: 6px 7px;
                vertical-align: top;
                font-size: 10.5px;
                overflow-wrap: anywhere;
            }

            .sisweb-print-table th,
            table th {
                background: #2c3e50;
                color: #fff;
                font-weight: 800;
                text-align: left;
            }

            .sisweb-print-table tbody tr:nth-child(even),
            table tbody tr:nth-child(even) {
                background: #fcfdff;
            }

            [data-col="acoes"],
            .acoes-cell,
            .action-buttons,
            .acoes-buttons,
            .commerce-actions-wrap,
            button,
            .no-print,
            .sel-carrego,
            .sel-carrego-all {
                display: none !important;
            }

            .status-badge {
                display: inline-block;
                padding: 2px 6px;
                border-radius: 4px;
                background: #edf2f7;
                color: #1f2937;
                font-weight: 700;
                font-size: 9.5px;
            }

            .sisweb-print-totals {
                width: 290px;
                margin-left: auto;
                background: #fff;
            }

            .sisweb-print-total-row,
            .summary-row {
                display: flex;
                justify-content: space-between;
                gap: 14px;
                padding: 5px 0;
                border-bottom: 1px solid #e5e7eb;
            }

            .sisweb-print-total-row:last-child,
            .summary-row:last-child {
                border-bottom: 0;
            }

            .sisweb-print-total-row.total {
                margin-top: 5px;
                padding-top: 8px;
                border-top: 2px solid #2c3e50;
                color: #1f2937;
                font-size: 13px;
                font-weight: 800;
            }

            .sisweb-print-signature {
                width: 300px;
                margin: 32px auto 0;
                padding-top: 8px;
                border-top: 1px solid #1f2937;
                text-align: center;
                color: #4b5563;
            }

            .sisweb-print-footer {
                margin-top: 18px;
                padding-top: 8px;
                border-top: 1px solid #e5e7eb;
                color: #6b7280;
                text-align: center;
                font-size: 9.5px;
                break-inside: avoid;
            }

            .text-right { text-align: right !important; }
            .text-center { text-align: center !important; }

            @media print {
                body.sisweb-commerce-print {
                    padding: 0;
                }

                .sisweb-print-header,
                .sisweb-print-info-box,
                .summary-box,
                .sisweb-print-totals,
                .sisweb-print-signature,
                tr {
                    break-inside: avoid;
                    page-break-inside: avoid;
                }
            }

            ${extraCss || ''}
        `;
    }

    function buildPrintDocument(options = {}) {
        const title = options.title || 'Relatorio';
        const printedAt = options.printedAt || new Date();
        const footer = options.footerHtml || `
            <footer class="sisweb-print-footer">
                <div>Documento gerado eletronicamente pelo Sisweb</div>
                <div>Impresso em: ${escapeHtml(printedAt.toLocaleDateString('pt-BR'))} as ${escapeHtml(printedAt.toLocaleTimeString('pt-BR'))}</div>
            </footer>
        `;
        return `<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <style>${getPrintStyles(options.extraCss || '')}</style>
</head>
<body class="sisweb-commerce-print">
    <main class="sisweb-print-page ${options.compact ? 'compact' : ''}">
        ${buildPrintHeader(options)}
        ${options.bodyHtml || ''}
        ${footer}
    </main>
</body>
</html>`;
    }

    function printHtmlDocument(options = {}) {
        const html = options.html || buildPrintDocument(options);
        const delay = Number.isFinite(options.printDelay) ? options.printDelay : 250;
        const target = window.open('', '_blank', options.windowFeatures || 'width=1100,height=800');

        if (target) {
            let printed = false;
            const triggerPrint = () => {
                if (printed) return;
                printed = true;
                setTimeout(() => target.print(), delay);
            };
            target.onload = triggerPrint;
            target.document.write(html);
            target.document.close();
            target.focus();
            setTimeout(triggerPrint, delay + 500);
            return target;
        }

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.setAttribute('aria-hidden', 'true');
        document.body.appendChild(iframe);
        iframe.onload = function () {
            setTimeout(() => {
                try {
                    iframe.contentWindow.focus();
                    iframe.contentWindow.print();
                } finally {
                    setTimeout(() => iframe.remove(), 30000);
                }
            }, delay);
        };
        iframe.srcdoc = html;
        return iframe;
    }

    function getJsPdfCtor() {
        if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
        if (window.jsPDF) return window.jsPDF;
        return null;
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Nao foi possivel carregar ${src}.`));
            document.head.appendChild(script);
        });
    }

    async function loadJsPdf() {
        const existing = getJsPdfCtor();
        if (existing) return existing;
        if (window.__siswebJsPdfLoading) return window.__siswebJsPdfLoading;

        window.__siswebJsPdfLoading = (async () => {
            const sources = [JSPDF_LOCAL, JSPDF_CDN];
            let lastError = null;
            for (const src of sources) {
                try {
                    await loadScript(src);
                    const ctor = getJsPdfCtor();
                    if (ctor) return ctor;
                    lastError = new Error('jsPDF carregado, mas indisponivel.');
                } catch (error) {
                    lastError = error;
                }
            }
            const ctor = getJsPdfCtor();
            if (ctor) return ctor;
            throw lastError || new Error('Nao foi possivel carregar jsPDF.');
        })();
        return window.__siswebJsPdfLoading;
    }

    function addWrapped(doc, value, x, y, maxWidth, options = {}) {
        const lineHeight = options.lineHeight || 5;
        const lines = doc.splitTextToSize(text(value), maxWidth);
        doc.text(lines, x, y, options);
        return y + Math.max(lines.length, 1) * lineHeight;
    }

    function addKeyValue(doc, label, value, x, y, labelWidth, valueWidth) {
        doc.setFont(undefined, 'bold');
        doc.text(label, x, y);
        doc.setFont(undefined, 'normal');
        return addWrapped(doc, value, x + labelWidth, y, valueWidth, { lineHeight: 4.5 });
    }

    function setPdfFill(doc, color) {
        doc.setFillColor(color[0], color[1], color[2]);
    }

    function setPdfDraw(doc, color) {
        doc.setDrawColor(color[0], color[1], color[2]);
    }

    function setPdfText(doc, color) {
        doc.setTextColor(color[0], color[1], color[2]);
    }

    function addPdfLogo(doc, company, x, y, size) {
        const normalized = normalizeCompany(company);
        setPdfDraw(doc, PRINT_COLORS.border);
        setPdfFill(doc, PRINT_COLORS.soft);
        doc.roundedRect(x, y, size, size, 1.5, 1.5, 'FD');

        if (isPdfImageDataUrl(normalized.logo)) {
            try {
                const type = getDataUrlImageType(normalized.logo);
                doc.addImage(normalized.logo, type, x + 2, y + 2, size - 4, size - 4, undefined, 'FAST');
                return;
            } catch (_) {
                // Fallback below keeps the document printable when logo data is unsupported.
            }
        }

        setPdfFill(doc, PRINT_COLORS.brand);
        doc.circle(x + size / 2, y + size / 2, size / 3, 'F');
        setPdfText(doc, [255, 255, 255]);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(10);
        doc.text(getInitials(normalized.name), x + size / 2, y + size / 2 + 3, { align: 'center' });
        doc.setFont(undefined, 'normal');
    }

    function addPdfPageHeader(doc, options, state) {
        const company = normalizeCompany(options.company || {});
        const headerY = state.margin;
        const headerHeight = 28;

        setPdfDraw(doc, PRINT_COLORS.border);
        setPdfFill(doc, [255, 255, 255]);
        doc.roundedRect(state.margin, headerY, state.contentWidth, headerHeight, 2, 2, 'S');
        setPdfFill(doc, PRINT_COLORS.brand);
        doc.rect(state.margin, headerY, state.contentWidth, 2.5, 'F');

        addPdfLogo(doc, options.company || {}, state.margin + 4, headerY + 5, 18);

        const companyX = state.margin + 27;
        setPdfText(doc, PRINT_COLORS.brandDark);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.text(doc.splitTextToSize(company.name.toUpperCase(), 82), companyX, headerY + 9);

        doc.setFont(undefined, 'normal');
        doc.setFontSize(7.2);
        setPdfText(doc, PRINT_COLORS.muted);
        const lineText = company.lines.join(' | ');
        if (lineText) {
            doc.text(doc.splitTextToSize(lineText, 95), companyX, headerY + 15);
        }

        const title = text(options.documentTitle || 'Pedidos');
        setPdfFill(doc, [233, 247, 239]);
        doc.roundedRect(state.pageWidth - state.margin - 36, headerY + 5, 36, 6, 1.5, 1.5, 'F');
        setPdfText(doc, [23, 106, 58]);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(6.6);
        doc.text(text(options.badgeText || 'SISWEB').toUpperCase(), state.pageWidth - state.margin - 18, headerY + 9, { align: 'center' });

        setPdfText(doc, PRINT_COLORS.brandDark);
        doc.setFontSize(12);
        doc.text(title, state.pageWidth - state.margin, headerY + 17, { align: 'right' });
        doc.setFont(undefined, 'normal');
        doc.setFontSize(7.2);
        setPdfText(doc, PRINT_COLORS.muted);
        doc.text(`Emissao: ${new Date().toLocaleString('pt-BR')}`, state.pageWidth - state.margin, headerY + 23, { align: 'right' });

        state.y = headerY + headerHeight + 10;
        setPdfText(doc, PRINT_COLORS.text);
    }

    function ensurePage(doc, y, needed, state) {
        if (y + needed <= state.pageHeight - state.margin) return y;
        doc.addPage();
        state.pageNumber += 1;
        addPdfPageHeader(doc, state.options || {}, state);
        return state.y;
    }

    function addTableHeader(doc, y, columns, state) {
        y = ensurePage(doc, y, 10, state);
        setPdfFill(doc, PRINT_COLORS.brand);
        doc.roundedRect(state.margin, y - 5, state.contentWidth, 8, 1, 1, 'F');
        setPdfText(doc, [255, 255, 255]);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(8);
        columns.forEach((col) => doc.text(col.label, col.x, y, { align: col.align || 'left' }));
        setPdfText(doc, PRINT_COLORS.text);
        doc.setFont(undefined, 'normal');
        return y + 7;
    }

    function addFooter(doc, state) {
        const pages = doc.getNumberOfPages();
        for (let i = 1; i <= pages; i += 1) {
            doc.setPage(i);
            doc.setFontSize(7);
            setPdfText(doc, PRINT_COLORS.muted);
            setPdfDraw(doc, PRINT_COLORS.border);
            doc.line(state.margin, state.pageHeight - 12, state.pageWidth - state.margin, state.pageHeight - 12);
            doc.text(`Sisweb - pagina ${i} de ${pages}`, state.margin, state.pageHeight - 8);
            doc.text(new Date().toLocaleString('pt-BR'), state.pageWidth - state.margin, state.pageHeight - 8, { align: 'right' });
        }
        setPdfText(doc, PRINT_COLORS.text);
    }

    function addOrder(doc, order, options, state) {
        const formatDate = options.formatDate || ((value) => text(value));
        const formatCurrency = options.formatCurrency || ((value) => text(value));
        const formatNumber = options.formatNumber || ((value) => text(value));
        const getStatusLabel = options.getStatusLabel || ((value) => text(value || 'pendente'));
        const getPaymentTypeLabel = options.getPaymentTypeLabel || ((value) => text(value));
        const orderNumber = text(order.numero || order.number || order.id);
        const items = Array.isArray(order.itens) ? order.itens : [];
        const payments = options.getPayments ? options.getPayments(order) : [];
        const partyName = options.getPartyName ? options.getPartyName(order) : '-';

        let y = ensurePage(doc, state.y, 42, state);

        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        setPdfText(doc, PRINT_COLORS.brandDark);
        doc.text(`${options.orderTitle || 'Pedido'} #${orderNumber}`, state.margin, y);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(8);
        setPdfText(doc, PRINT_COLORS.muted);
        doc.text(`Documento gerado em ${new Date().toLocaleString('pt-BR')}`, state.pageWidth - state.margin, y, { align: 'right' });
        y += 8;

        setPdfDraw(doc, PRINT_COLORS.border);
        setPdfFill(doc, PRINT_COLORS.soft);
        doc.roundedRect(state.margin, y - 4, state.contentWidth, 24, 2, 2, 'FD');
        setPdfText(doc, PRINT_COLORS.text);
        doc.setFontSize(8.5);
        y = addKeyValue(doc, `${options.partyLabel || 'Cliente'}:`, partyName, state.margin + 4, y, 27, state.contentWidth - 34);
        y = addKeyValue(doc, 'Data:', formatDate(order.data), state.margin + 4, y, 27, 70);
        y = addKeyValue(doc, 'Status:', getStatusLabel(order.status || 'pendente'), state.margin + 4, y, 27, 70);
        y += 6;

        doc.setFontSize(9.5);
        doc.setFont(undefined, 'bold');
        setPdfText(doc, PRINT_COLORS.brandDark);
        doc.text('ITENS DO PEDIDO', state.margin, y);
        doc.setFont(undefined, 'normal');
        y += 7;

        const itemColumns = [
            { label: '#', x: state.margin + 3 },
            { label: 'Produto', x: state.margin + 13 },
            { label: 'Qtd.', x: state.margin + 120, align: 'right' },
            { label: 'Preco', x: state.margin + 151, align: 'right' },
            { label: 'Total', x: state.margin + 184, align: 'right' }
        ];
        y = addTableHeader(doc, y, itemColumns, state);
        doc.setFontSize(8);
        setPdfText(doc, PRINT_COLORS.text);

        if (!items.length) {
            y = ensurePage(doc, y, 8, state);
            doc.text('Nenhum item informado.', state.margin + 3, y);
            y += 7;
        } else {
            items.forEach((item, index) => {
                const productRaw = item.produtoCodigo
                    ? `${item.produtoCodigo} - ${item.produtoNome || item.produto || item.nome || item.descricao || ''}`
                    : (item.produtoNome || item.produto || item.nome || item.descricao);
                const product = text(productRaw);
                const productLines = doc.splitTextToSize(product, 90);
                const rowHeight = Math.max(7, productLines.length * 4.2 + 2);
                y = ensurePage(doc, y, rowHeight + 2, state);

                if (index % 2 === 1) {
                    setPdfFill(doc, PRINT_COLORS.stripe);
                    doc.rect(state.margin, y - 4.5, state.contentWidth, rowHeight + 1, 'F');
                }
                setPdfDraw(doc, PRINT_COLORS.border);
                doc.line(state.margin, y - 4.5, state.margin + state.contentWidth, y - 4.5);
                setPdfText(doc, PRINT_COLORS.text);
                doc.text(String(index + 1), state.margin + 3, y);
                doc.text(productLines, state.margin + 13, y);
                const quantity = item.unidade
                    ? `${formatNumber(item.quantidade || 0)} ${item.unidade}`
                    : formatNumber(item.quantidade || 0);
                doc.text(text(quantity), state.margin + 120, y, { align: 'right' });
                doc.text(formatCurrency(item.precoUnitario || item.preco || 0), state.margin + 151, y, { align: 'right' });
                doc.setFont(undefined, 'bold');
                doc.text(formatCurrency(item.total || 0), state.margin + 184, y, { align: 'right' });
                doc.setFont(undefined, 'normal');
                y += rowHeight;
            });
        }

        y += 5;
        y = ensurePage(doc, y, 30, state);
        const subtotal = typeof options.getSubtotal === 'function' ? options.getSubtotal(order) : order.subtotal;
        const discount = typeof options.getDiscount === 'function' ? options.getDiscount(order) : order.desconto;
        const total = typeof options.getTotal === 'function' ? options.getTotal(order) : order.total;
        const totalsX = state.pageWidth - state.margin - 72;
        setPdfDraw(doc, PRINT_COLORS.border);
        setPdfFill(doc, [255, 255, 255]);
        doc.roundedRect(totalsX, y - 4, 72, 27, 2, 2, 'S');
        doc.setFontSize(8.8);
        const totalRows = [
            ['Subtotal', formatCurrency(subtotal || 0), false],
            ['Desconto', formatCurrency(discount || 0), false],
            ['TOTAL', formatCurrency(total || 0), true]
        ];
        totalRows.forEach((row, index) => {
            const rowY = y + index * 7;
            if (row[2]) {
                setPdfDraw(doc, PRINT_COLORS.brand);
                doc.line(totalsX + 4, rowY - 3.5, totalsX + 68, rowY - 3.5);
                doc.setFontSize(10.5);
                doc.setFont(undefined, 'bold');
                setPdfText(doc, PRINT_COLORS.brandDark);
            } else {
                doc.setFontSize(8.8);
                doc.setFont(undefined, 'normal');
                setPdfText(doc, PRINT_COLORS.text);
            }
            doc.text(row[0], totalsX + 4, rowY);
            doc.text(row[1], totalsX + 68, rowY, { align: 'right' });
        });
        doc.setFont(undefined, 'normal');
        y += 33;

        if (payments && payments.length) {
            y = ensurePage(doc, y, 22, state);
            doc.setFontSize(9.5);
            doc.setFont(undefined, 'bold');
            setPdfText(doc, PRINT_COLORS.brandDark);
            doc.text(String(options.paymentTitle || 'FORMA DE PAGAMENTO').toUpperCase(), state.margin, y);
            doc.setFont(undefined, 'normal');
            y += 7;
            payments.forEach((payment) => {
                const line = [
                    formatDate(payment.vencimento || payment.dataVencimento),
                    getPaymentTypeLabel(payment.tipo || payment.tipoPagamento),
                    formatCurrency(payment.valor || 0),
                    payment.observacao || payment.observacoes || ''
                ].filter(Boolean).map(text).join(' | ');
                const lines = doc.splitTextToSize(line, state.contentWidth - 8);
                y = ensurePage(doc, y, Math.max(8, lines.length * 4.2 + 4), state);
                setPdfFill(doc, PRINT_COLORS.soft);
                setPdfDraw(doc, PRINT_COLORS.border);
                doc.roundedRect(state.margin, y - 4.5, state.contentWidth, Math.max(7, lines.length * 4.2 + 2), 1.5, 1.5, 'FD');
                setPdfText(doc, PRINT_COLORS.text);
                doc.setFontSize(8);
                doc.text(lines, state.margin + 4, y);
                y += Math.max(8, lines.length * 4.2 + 4);
            });
            y += 4;
        }

        state.y = y + 8;
    }

    function plainReportText(value, fallback = '-') {
        const raw = String(value ?? '');
        const withoutTags = raw
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/(p|div|span|td|th|li|tr)>/gi, ' ')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&#39;/gi, "'");
        return text(withoutTags, fallback);
    }

    function normalizeReportColumns(columns = []) {
        return (Array.isArray(columns) ? columns : [])
            .map((column, index) => {
                const source = typeof column === 'string' ? { label: column } : (column || {});
                const label = text(source.label || source.title || source.key || `Coluna ${index + 1}`);
                return {
                    label,
                    key: source.key || label,
                    align: source.align || source.textAlign || 'left',
                    weight: Math.max(0.6, Number(source.weight || source.width || Math.min(Math.max(label.length / 8, 1), 2.4)) || 1)
                };
            });
    }

    function normalizeReportRows(rows = [], columns = []) {
        return (Array.isArray(rows) ? rows : [])
            .map((row) => {
                if (Array.isArray(row)) return row.map((cell) => plainReportText(cell));
                if (row && typeof row === 'object') {
                    return columns.map((column) => plainReportText(row[column.key]));
                }
                return [plainReportText(row)];
            });
    }

    function normalizeSummaryRows(rows = []) {
        return (Array.isArray(rows) ? rows : [])
            .map((row) => {
                if (Array.isArray(row)) return { label: plainReportText(row[0]), value: plainReportText(row[1]) };
                if (row && typeof row === 'object') {
                    return { label: plainReportText(row.label || row.title), value: plainReportText(row.value || row.total || row.text) };
                }
                return null;
            })
            .filter((row) => row && (row.label || row.value));
    }

    function getReportColumnWidths(columns, contentWidth) {
        const totalWeight = columns.reduce((sum, column) => sum + column.weight, 0) || columns.length || 1;
        return columns.map((column) => Math.max(6, (contentWidth * column.weight) / totalWeight));
    }

    function getReportFontSize(columnCount, options = {}) {
        if (Number.isFinite(options.fontSize)) return options.fontSize;
        if (columnCount >= 16) return 5.6;
        if (columnCount >= 12) return 6.2;
        if (columnCount >= 9) return 6.8;
        return 7.5;
    }

    function addReportSummary(doc, rows, state) {
        const summaryRows = normalizeSummaryRows(rows);
        if (!summaryRows.length) return;

        let y = ensurePage(doc, state.y, Math.min(36, summaryRows.length * 5 + 12), state);
        const boxHeight = Math.max(12, summaryRows.length * 5 + 7);
        setPdfDraw(doc, PRINT_COLORS.border);
        setPdfFill(doc, PRINT_COLORS.soft);
        doc.roundedRect(state.margin, y - 5, state.contentWidth, boxHeight, 1.5, 1.5, 'FD');
        doc.setFontSize(7.6);
        summaryRows.forEach((row, index) => {
            const rowY = y + index * 5;
            setPdfText(doc, PRINT_COLORS.muted);
            doc.setFont(undefined, 'bold');
            doc.text(`${row.label}:`, state.margin + 4, rowY);
            setPdfText(doc, PRINT_COLORS.text);
            doc.setFont(undefined, 'normal');
            doc.text(row.value, state.margin + state.contentWidth - 4, rowY, { align: 'right' });
        });
        state.y = y + boxHeight + 3;
    }

    function addReportTableHeader(doc, y, columns, widths, state, fontSize) {
        y = ensurePage(doc, y, 10, state);
        setPdfFill(doc, PRINT_COLORS.brand);
        doc.rect(state.margin, y - 5, state.contentWidth, 8, 'F');
        setPdfText(doc, [255, 255, 255]);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(fontSize);

        let x = state.margin + 1.5;
        columns.forEach((column, index) => {
            const width = widths[index] || 10;
            const lines = doc.splitTextToSize(column.label, Math.max(4, width - 2));
            doc.text(lines.slice(0, 2), x, y - (lines.length > 1 ? 1.5 : 0), { align: column.align || 'left' });
            x += width;
        });
        doc.setFont(undefined, 'normal');
        setPdfText(doc, PRINT_COLORS.text);
        return y + 7;
    }

    function ensureReportTableSpace(doc, state, needed, columns, widths, fontSize) {
        const beforePage = state.pageNumber;
        let y = ensurePage(doc, state.y, needed, state);
        if (state.pageNumber !== beforePage) {
            y = addReportTableHeader(doc, state.y, columns, widths, state, fontSize);
        }
        state.y = y;
        return y;
    }

    function addReportTable(doc, table, state, options = {}) {
        const columns = normalizeReportColumns(table.columns || options.columns || []);
        if (!columns.length) return;

        const rows = normalizeReportRows(table.rows || [], columns);
        const widths = getReportColumnWidths(columns, state.contentWidth);
        const fontSize = getReportFontSize(columns.length, table);
        const lineHeight = Math.max(3.1, fontSize * 0.52);

        if (table.title) {
            let yTitle = ensurePage(doc, state.y, 12, state);
            doc.setFont(undefined, 'bold');
            doc.setFontSize(9.5);
            setPdfText(doc, PRINT_COLORS.brandDark);
            doc.text(plainReportText(table.title), state.margin, yTitle);
            doc.setFont(undefined, 'normal');
            state.y = yTitle + 7;
        }

        state.y = addReportTableHeader(doc, state.y, columns, widths, state, fontSize);
        doc.setFontSize(fontSize);
        setPdfText(doc, PRINT_COLORS.text);

        if (!rows.length) {
            state.y = ensureReportTableSpace(doc, state, 8, columns, widths, fontSize);
            doc.text(plainReportText(table.emptyText || 'Nenhum registro encontrado.'), state.margin + 2, state.y);
            state.y += 7;
            return;
        }

        rows.forEach((row, rowIndex) => {
            const cellLines = columns.map((column, index) => {
                const value = row[index] ?? '';
                return doc.splitTextToSize(plainReportText(value), Math.max(4, (widths[index] || 10) - 2));
            });
            const rowHeight = Math.max(6, Math.max(...cellLines.map((lines) => lines.length), 1) * lineHeight + 2);
            state.y = ensureReportTableSpace(doc, state, rowHeight + 2, columns, widths, fontSize);

            if (rowIndex % 2 === 1) {
                setPdfFill(doc, PRINT_COLORS.stripe);
                doc.rect(state.margin, state.y - 4.5, state.contentWidth, rowHeight, 'F');
            }

            setPdfDraw(doc, PRINT_COLORS.border);
            doc.line(state.margin, state.y - 4.5, state.margin + state.contentWidth, state.y - 4.5);

            let x = state.margin + 1.5;
            cellLines.forEach((lines, index) => {
                const align = columns[index].align === 'right' ? 'right' : (columns[index].align === 'center' ? 'center' : 'left');
                const width = widths[index] || 10;
                const textX = align === 'right' ? x + width - 1.5 : (align === 'center' ? x + width / 2 : x);
                doc.text(lines, textX, state.y, { align });
                x += width;
            });
            state.y += rowHeight;
        });
        state.y += 5;
    }

    async function createTableReportPdf(options = {}) {
        const JsPDF = await loadJsPdf();
        const preparedOptions = await preparePdfOptions({
            ...options,
            documentTitle: options.documentTitle || options.title || 'Relatorio'
        });
        const doc = new JsPDF({ orientation: options.orientation || 'landscape', unit: 'mm', format: 'a4' });
        const state = {
            pageWidth: doc.internal.pageSize.getWidth(),
            pageHeight: doc.internal.pageSize.getHeight(),
            margin: 10,
            contentWidth: doc.internal.pageSize.getWidth() - 20,
            y: 12,
            pageNumber: 1,
            options: preparedOptions
        };

        addPdfPageHeader(doc, preparedOptions, state);
        addReportSummary(doc, preparedOptions.summaryRows, state);

        const tables = Array.isArray(preparedOptions.tables) && preparedOptions.tables.length
            ? preparedOptions.tables
            : [{
                title: preparedOptions.tableTitle,
                columns: preparedOptions.columns,
                rows: preparedOptions.rows,
                emptyText: preparedOptions.emptyText
            }];
        tables.forEach((table) => addReportTable(doc, table, state, preparedOptions));

        addFooter(doc, state);
        return doc.output('blob');
    }

    async function exportTableReportPdf(options = {}) {
        const blob = await createTableReportPdf(options);
        const result = await deliverPdf(blob, options.fileName || `${options.title || 'relatorio'}.pdf`, {
            title: options.documentTitle || options.title,
            text: options.shareText || 'PDF de relatorio gerado pelo Sisweb.'
        });
        return { ...result, blob };
    }

    async function createOrdersPdf(options) {
        const JsPDF = await loadJsPdf();
        const preparedOptions = await preparePdfOptions(options || {});
        const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const state = {
            pageWidth: doc.internal.pageSize.getWidth(),
            pageHeight: doc.internal.pageSize.getHeight(),
            margin: 12,
            contentWidth: doc.internal.pageSize.getWidth() - 24,
            y: 14,
            pageNumber: 1,
            options: preparedOptions
        };

        const orders = Array.isArray(preparedOptions.orders) ? preparedOptions.orders : [];
        orders.forEach((order, index) => {
            if (index > 0) {
                doc.addPage();
                state.pageNumber += 1;
            }
            addPdfPageHeader(doc, preparedOptions, state);
            addOrder(doc, order, preparedOptions, state);
        });

        addFooter(doc, state);
        return doc.output('blob');
    }

    function downloadBlob(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 30000);
    }

    async function deliverPdf(blob, fileName, options = {}) {
        const safeName = sanitizeFileName(fileName).replace(/\.pdf$/i, '') + '.pdf';
        const file = typeof File === 'function'
            ? new File([blob], safeName, { type: 'application/pdf' })
            : null;
        if (file && navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    title: options.title || safeName,
                    text: options.text || 'PDF gerado pelo Sisweb.',
                    files: [file]
                });
                return { mode: 'share', fileName: safeName };
            } catch (error) {
                if (error && error.name === 'AbortError') return { mode: 'cancelled', fileName: safeName };
            }
        }
        downloadBlob(blob, safeName);
        return { mode: 'download', fileName: safeName };
    }

    async function exportOrdersPdf(options) {
        const blob = await createOrdersPdf(options);
        const result = await deliverPdf(blob, options.fileName || 'pedidos.pdf', {
            title: options.documentTitle,
            text: options.shareText
        });
        return { ...result, blob };
    }

    window.SiswebCommercePdf = {
        exportOrdersPdf,
        createOrdersPdf,
        exportTableReportPdf,
        createTableReportPdf,
        deliverPdf,
        sanitizeFileName,
        escapeHtml,
        buildPrintDocument,
        buildPrintHeader,
        getPrintStyles,
        printHtmlDocument,
        preparePrintOptions,
        resolveCompanyLogoDataUrl
    };
})();
