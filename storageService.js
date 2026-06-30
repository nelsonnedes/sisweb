/**
 * Sisweb 3.0 - Storage Service
 * Gerenciamento centralizado de uploads e downloads de binários (Fim do Base64)
 */

/**
 * Classifica erros do Firebase Storage e retorna uma mensagem amigável em PT-BR.
 * @param {Error} error
 * @returns {{ isQuotaExceeded: boolean, message: string }}
 */
function _classifyStorageError(error) {
    const code = (error && (error.code || '')).toString();
    if (code === 'storage/quota-exceeded' || (error && error.message && error.message.includes('quota-exceeded'))) {
        return {
            isQuotaExceeded: true,
            message: '⚠️ Armazenamento esgotado: A cota do Firebase Storage foi atingida. ' +
                     'Acesse o Firebase Console → Storage e faça upgrade para o plano Blaze. ' +
                     'Entre em contato com o administrador do sistema.'
        };
    }
    if (code === 'storage/unauthorized' || code === 'storage/unauthenticated') {
        return { isQuotaExceeded: false, message: 'Sem permissão para fazer upload. Verifique seu login.' };
    }
    if (code === 'storage/canceled') {
        return { isQuotaExceeded: false, message: 'Upload cancelado.' };
    }
    return { isQuotaExceeded: false, message: 'Falha no upload do anexo. Verifique regras de acesso ou tamanho do arquivo.' };
}

function _getActiveTenantId() {
    const svc = window.firebaseService || {};
    if (typeof svc.getCurrentTenantId === 'function') return svc.getCurrentTenantId();
    if (typeof svc.getTenantId === 'function') return svc.getTenantId();
    return window.appTenantId || null;
}

function _sanitizeFileName(name) {
    return String(name || 'arquivo').replace(/[^\w.\-]+/g, '_').slice(0, 100) || 'arquivo';
}

function _sanitizeRelativePath(path) {
    const clean = String(path || '').replace(/^\/+/, '').trim();
    if (!clean || clean.includes('..') || clean.includes('//')) {
        throw new Error('Caminho de Storage inválido.');
    }
    if (/^companies\//.test(clean) || /^users\//.test(clean)) {
        throw new Error('Caminho de upload deve ser relativo ao tenant.');
    }
    return clean;
}

function _sanitizeTenantStoragePath(path) {
    const clean = String(path || '').replace(/^\/+/, '').trim();
    if (!clean || clean.includes('..') || clean.includes('//')) {
        throw new Error('Caminho de Storage inválido.');
    }
    const match = clean.match(/^(companies|tenants)\/([^/]+)\//);
    if (!match) {
        throw new Error('Caminho de Storage deve iniciar com companies/{tenantId}/ ou tenants/{tenantId}/.');
    }
    const activeTenant = _getActiveTenantId();
    if (activeTenant && String(activeTenant) !== String(match[2])) {
        throw new Error('Caminho de Storage pertence a outro tenant.');
    }
    return clean;
}

function _extractStoragePathFromUrl(pathOrUrl) {
    const raw = String(pathOrUrl || '').trim();
    if (!raw) return '';
    if (/^gs:\/\//i.test(raw)) return raw.replace(/^gs:\/\/[^/]+\//i, '').replace(/^\/+/, '');
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

function _resolveReplaceStoragePath(path) {
    if (!path) return '';
    return _sanitizeTenantStoragePath(_extractStoragePathFromUrl(path) || path);
}

function _coerceUploadBody(data, contentType) {
    if (data instanceof Blob) return data;
    if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
        return new Blob([data], { type: contentType || 'application/octet-stream' });
    }
    if (typeof data === 'string') {
        return new Blob([data], { type: contentType || 'text/plain' });
    }
    return data;
}

const SUPPORT_ATTACHMENT_MAX_FILES = 3;
const SUPPORT_ATTACHMENT_MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
const SUPPORT_ATTACHMENT_MAX_IMAGE_SOURCE_BYTES = 12 * 1024 * 1024;
const SUPPORT_ATTACHMENT_ALLOWED_TYPES = /^(image\/(png|jpe?g|webp|gif)|application\/pdf)$/i;

function _sanitizeStorageSegment(value, fallback = 'item') {
    const clean = String(value || '').replace(/[^\w.\-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
    return clean || fallback;
}

function _replaceFileExtension(name, extension) {
    const safe = _sanitizeFileName(name || 'imagem');
    const base = safe.replace(/\.[^.]+$/, '') || 'imagem';
    return `${base}.${String(extension || 'jpg').replace(/^\.+/, '')}`;
}

function _loadImageElement(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Não foi possível ler a imagem para compressão.'));
        };
        img.src = url;
    });
}

function _canvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), type, quality);
    });
}

async function _compressImageWithCanvas(file, options = {}) {
    const sourceType = String(file && file.type || '').toLowerCase();
    if (!sourceType.startsWith('image/') || sourceType === 'image/gif' || sourceType === 'image/svg+xml') {
        return file;
    }
    const maxWidthOrHeight = Math.max(640, Math.min(1920, Number(options.maxWidthOrHeight || 1280)));
    const maxBytes = Math.max(128 * 1024, Math.min(2 * 1024 * 1024, Number(options.maxSizeMB || 0.5) * 1024 * 1024));
    const image = await _loadImageElement(file);
    const scale = Math.min(1, maxWidthOrHeight / Math.max(image.naturalWidth || image.width || 1, image.naturalHeight || image.height || 1));
    const width = Math.max(1, Math.round((image.naturalWidth || image.width || 1) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || image.height || 1) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    const outputType = sourceType === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const extension = outputType === 'image/webp' ? 'webp' : 'jpg';
    let quality = 0.84;
    let blob = await _canvasToBlob(canvas, outputType, quality);
    while (blob && blob.size > maxBytes && quality > 0.58) {
        quality = Math.max(0.58, quality - 0.08);
        blob = await _canvasToBlob(canvas, outputType, quality);
    }
    if (!blob || blob.size >= Number(file.size || 0)) return file;
    const nextName = _replaceFileExtension(file.name || 'imagem', extension);
    try {
        return new File([blob], nextName, { type: outputType, lastModified: Date.now() });
    } catch (_) {
        blob.name = nextName;
        return blob;
    }
}

async function _prepareUploadFile(file, options = {}) {
    let processedFile = file;
    const customMetadata = {};
    if (file.type && file.type.startsWith('image/')) {
        try {
            const compressor = typeof window.imageCompression === 'function'
                ? window.imageCompression
                : (typeof imageCompression === 'function' ? imageCompression : null);
            if (compressor) {
                if (typeof mostrarNotificacao === 'function') mostrarNotificacao('Comprimindo imagem...', 'info');
                const compressionOptions = {
                    maxSizeMB: Number(options.maxSizeMB || 0.5),
                    maxWidthOrHeight: Number(options.maxWidthOrHeight || 1280),
                    useWebWorker: true
                };
                processedFile = await compressor(file, compressionOptions);
            } else {
                processedFile = await _compressImageWithCanvas(file, options);
            }
            if (processedFile !== file && Number(processedFile.size || 0) < Number(file.size || 0)) {
                customMetadata.compressed = 'true';
                customMetadata.originalSize = String(Number(file.size || 0));
                console.log(`✅ Imagem comprimida: ${(file.size/1024/1024).toFixed(2)}MB -> ${(processedFile.size/1024/1024).toFixed(2)}MB`);
            } else {
                processedFile = file;
                customMetadata.compressed = 'false';
            }
        } catch (err) {
            console.error('Erro ao comprimir imagem, enviando original.', err);
            processedFile = file;
            customMetadata.compressed = 'false';
        }
    }
    return { processedFile, customMetadata };
}

function _normalizeUploadResult(result, safePath, file, processedFile) {
    const source = result && typeof result === 'object' ? result : {};
    const url = source.url || source.downloadURL || (typeof result === 'string' ? result : '');
    return {
        url,
        downloadURL: url,
        storagePath: source.storagePath || source.path || safePath,
        fileName: _sanitizeFileName((processedFile && processedFile.name) || (file && file.name) || 'arquivo'),
        name: _sanitizeFileName((processedFile && processedFile.name) || (file && file.name) || 'arquivo'),
        contentType: (processedFile && processedFile.type) || (file && file.type) || '',
        size: Number((processedFile && processedFile.size) || (file && file.size) || 0) || null,
        originalSize: Number((file && file.size) || 0) || null,
        compressed: !!(processedFile && file && processedFile !== file && Number(processedFile.size || 0) < Number(file.size || 0)),
        uploadedAt: new Date().toISOString(),
        uploadedBy: (window.firebaseService && typeof window.firebaseService.getCurrentUid === 'function')
            ? (window.firebaseService.getCurrentUid() || null)
            : null
    };
}

async function _uploadTenantFile(file, path, options = {}) {
    if (!file) throw new Error("Nenhum arquivo providenciado.");
    if (!window.firebaseService || !window.firebaseService.storage || typeof window.firebaseService.storage.upload !== 'function') {
        throw new Error('Firebase Storage não inicializado.');
    }
    const tenantId = _getActiveTenantId();
    if (!tenantId) throw new Error("Acesso negado: Tenant (Empresa) não identificado.");
    const relativePath = _sanitizeRelativePath(path);
    const { processedFile, customMetadata } = await _prepareUploadFile(file, options);
    const safeFileName = _sanitizeFileName(processedFile.name || file.name);
    const replacePath = _resolveReplaceStoragePath(options.replaceStoragePath || options.previousStoragePath || '');
    const safePath = replacePath || `companies/${tenantId}/${relativePath}_${Date.now()}_${safeFileName}`;
    if (typeof mostrarNotificacao === 'function') mostrarNotificacao('Fazendo upload seguro do anexo...', 'info');
    const result = await window.firebaseService.storage.upload(safePath, processedFile, {
        contentType: processedFile.type || file.type || undefined,
        customMetadata: {
            ...customMetadata,
            tenantId: String(tenantId),
            uploadedAt: new Date().toISOString(),
            storageMode: replacePath ? 'replace' : 'append'
        }
    });
    const meta = _normalizeUploadResult(result, safePath, file, processedFile);
    if (!meta.url) throw new Error('Upload concluído sem URL de download.');
    if (typeof mostrarNotificacao === 'function') mostrarNotificacao('Upload concluído com sucesso!', 'success');
    return meta;
}

window.storageService = {
    async upload(path, data, contentTypeOrOptions = {}) {
        try {
            if (!window.firebaseService || !window.firebaseService.storage || typeof window.firebaseService.storage.upload !== 'function') {
                throw new Error('Firebase Storage não inicializado.');
            }
            const safePath = _sanitizeTenantStoragePath(path);
            const options = typeof contentTypeOrOptions === 'string'
                ? { contentType: contentTypeOrOptions }
                : (contentTypeOrOptions && typeof contentTypeOrOptions === 'object' ? contentTypeOrOptions : {});
            const contentType = options.contentType || (data && data.type) || 'application/octet-stream';
            const uploadBody = _coerceUploadBody(data, contentType);
            const result = await window.firebaseService.storage.upload(safePath, uploadBody, {
                ...options,
                contentType,
                customMetadata: {
                    ...(options.customMetadata || {}),
                    uploadedAt: new Date().toISOString()
                }
            });
            return result && typeof result === 'object'
                ? (result.url || result.downloadURL || result)
                : result;
        } catch (error) {
            console.error("Erro no upload direto para o Storage:", error);
            const classified = _classifyStorageError(error);
            if (typeof mostrarNotificacao === 'function') mostrarNotificacao(classified.message, 'error');
            throw error;
        }
    },

    async download(pathOrUrl) {
        const raw = String(pathOrUrl || '').trim();
        if (!raw) throw new Error('Caminho de Storage não informado.');
        const target = /^https?:\/\//i.test(raw) ? raw : _sanitizeTenantStoragePath(raw);
        const resolver = window.firebaseService && window.firebaseService.storage && typeof window.firebaseService.storage.getDownloadURL === 'function'
            ? window.firebaseService.storage.getDownloadURL
            : (window.firebaseService && typeof window.firebaseService.getStorageDownloadURL === 'function' ? window.firebaseService.getStorageDownloadURL : null);
        if (!resolver) throw new Error('Firebase Storage não inicializado.');
        const url = /^https?:\/\//i.test(target) ? target : await resolver(target);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Falha ao baixar arquivo do Storage (${response.status}).`);
        return await response.arrayBuffer();
    },

    /**
     * Faz o upload de um arquivo para o Storage isolado por Tenant
     * @param {File} file O objeto File extraído do <input type="file">
     * @param {string} path Caminho de destino (ex: 'financas/anexos/FR-832123')
     * @returns {Promise<string>} URL de download pública do arquivo
     */
    async uploadFile(file, path, options = {}) {
        try {
            const meta = await _uploadTenantFile(file, path, options);
            return meta.url;
        } catch (error) {
            console.error("Erro no upload para o Storage:", error);
            const classified = _classifyStorageError(error);
            if (typeof mostrarNotificacao === 'function') mostrarNotificacao(classified.message, 'error');
            throw error;
        }
    },

    async uploadFileWithPath(file, path, options = {}) {
        try {
            return await _uploadTenantFile(file, path, options);
        } catch (error) {
            console.error("Erro no upload para o Storage:", error);
            const classified = _classifyStorageError(error);
            if (typeof mostrarNotificacao === 'function') mostrarNotificacao(classified.message, 'error');
            throw error;
        }
    },

    async uploadAttachment(file, path, extra = {}, options = {}) {
        const meta = await this.uploadFileWithPath(file, path, options);
        return {
            ...meta,
            ...extra,
            storagePath: meta.storagePath || null,
            url: meta.url || meta.downloadURL || '',
            downloadURL: meta.downloadURL || meta.url || '',
            name: extra.name || meta.name || meta.fileName || 'arquivo',
            fileName: extra.fileName || meta.fileName || meta.name || 'arquivo'
        };
    },

    async uploadSupportAttachment(file, context = {}) {
        if (!file) throw new Error('Arquivo de suporte não informado.');
        const contentType = String(file.type || '').toLowerCase();
        if (!SUPPORT_ATTACHMENT_ALLOWED_TYPES.test(contentType)) {
            throw new Error('Anexo inválido. Envie imagem PNG/JPG/WEBP/GIF ou PDF.');
        }
        const originalSize = Number(file.size || 0);
        if (contentType === 'application/pdf' && originalSize > SUPPORT_ATTACHMENT_MAX_UPLOAD_BYTES) {
            throw new Error('PDF acima de 6MB. Reduza o arquivo antes de anexar.');
        }
        if (contentType.startsWith('image/') && originalSize > SUPPORT_ATTACHMENT_MAX_IMAGE_SOURCE_BYTES) {
            throw new Error('Imagem acima de 12MB. Envie um print menor.');
        }
        const service = window.firebaseService || {};
        if (!service || typeof service.uploadFile !== 'function') {
            throw new Error('Firebase Storage não inicializado para anexos de suporte.');
        }
        const companyId = _sanitizeStorageSegment(context.companyId || _getActiveTenantId(), '');
        if (!companyId) throw new Error('Empresa/Tenant não identificado para anexar no ticket.');
        const uploaderUid = _sanitizeStorageSegment(
            context.uid || (typeof service.getCurrentUid === 'function' ? service.getCurrentUid() : '') || 'usuario',
            'usuario'
        );
        const ticketId = _sanitizeStorageSegment(context.ticketId || context.scope || 'novo-ticket', 'novo-ticket');
        const role = _sanitizeStorageSegment(context.role || 'customer', 'customer');
        const { processedFile, customMetadata } = await _prepareUploadFile(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1280 });
        if (Number(processedFile.size || 0) > SUPPORT_ATTACHMENT_MAX_UPLOAD_BYTES) {
            throw new Error('Anexo ficou acima de 6MB após o tratamento. Reduza o arquivo e tente novamente.');
        }
        const safeFileName = _sanitizeFileName((processedFile && processedFile.name) || file.name || 'anexo');
        const safePath = `companies/${companyId}/support/tickets/${ticketId}/${role}_${uploaderUid}_${Date.now()}_${safeFileName}`;
        const result = await service.uploadFile(safePath, processedFile, {
            contentType: processedFile.type || file.type || 'application/octet-stream',
            customMetadata: {
                ...customMetadata,
                module: 'support',
                companyId: String(companyId),
                uploaderUid: String(uploaderUid),
                ticketId: String(ticketId),
                originalName: _sanitizeFileName(file.name || 'anexo'),
                uploadedAt: new Date().toISOString()
            }
        });
        if (!result || result.success === false) {
            throw new Error((result && result.error) || 'Falha no upload do anexo de suporte.');
        }
        const meta = _normalizeUploadResult(result, safePath, file, processedFile);
        if (!meta.url) throw new Error('Upload concluído sem URL de download.');
        return {
            ...meta,
            module: 'support',
            role,
            ticketId: context.ticketId || '',
            companyId,
            maxFiles: SUPPORT_ATTACHMENT_MAX_FILES
        };
    },

    normalizeAttachmentMeta(input = {}) {
        const source = input && typeof input === 'object' ? input : {};
        const url = String(source.url || source.downloadURL || source.comprovanteUrl || source.anexoUrl || '').trim();
        return {
            url,
            downloadURL: url,
            storagePath: source.storagePath || source.comprovanteStoragePath || source.path || null,
            name: source.name || source.fileName || 'arquivo',
            fileName: source.fileName || source.name || 'arquivo',
            contentType: source.contentType || source.mimeType || '',
            size: typeof source.size === 'number' ? source.size : null,
            uploadedAt: source.uploadedAt || source.createdAt || source.data || null,
            uploadedBy: source.uploadedBy || null,
            legacy: source.legacy === true
        };
    },

    /**
     * Método Lazy Load: Renderiza um botão de Ação otimizado para tabelas
     * Só carrega o anexo quando o usuário clica, evitando preloads pesados e travamentos.
     * @param {string} url URL do anexo no Storage
     * @param {string} type Tipo do arquivo (imagem, pdf)
     */
    renderLazyAttachmentButton(url, title = "Ver Comprovante") {
        if (!url) return '';
        return `
            <button type="button" class="btn btn-sm btn-outline-info" 
                onclick="window.open('${url}', '_blank')" 
                title="${title}">
                <i class="fas fa-paperclip"></i>
            </button>
        `;
    }
};
