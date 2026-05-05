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

window.storageService = {
    /**
     * Faz o upload de um arquivo para o Storage isolado por Tenant
     * @param {File} file O objeto File extraído do <input type="file">
     * @param {string} path Caminho de destino (ex: 'financas/anexos/FR-832123')
     * @returns {Promise<string>} URL de download pública do arquivo
     */
    async uploadFile(file, path) {
        if (!file) throw new Error("Nenhum arquivo providenciado.");
        
        const tenantId = window.firebaseService.getCurrentTenantId ? window.firebaseService.getCurrentTenantId() : null;
        if (!tenantId) throw new Error("Acesso negado: Tenant (Empresa) não identificado.");

        // Compressão Client-Side (Plano Otimização Blaze)
        let processedFile = file;
        const customMetadata = {};
        if (file.type && file.type.startsWith('image/')) {
            try {
                if (typeof window.imageCompression === 'function') {
                    if (typeof mostrarNotificacao === 'function') mostrarNotificacao('Comprimindo imagem...', 'info');
                    const options = {
                        maxSizeMB: 0.5,
                        maxWidthOrHeight: 1280,
                        useWebWorker: true
                    };
                    processedFile = await window.imageCompression(file, options);
                    customMetadata.compressed = 'true';
                    console.log(`✅ Imagem comprimida: ${(file.size/1024/1024).toFixed(2)}MB -> ${(processedFile.size/1024/1024).toFixed(2)}MB`);
                } else if (typeof imageCompression === 'function') {
                    if (typeof mostrarNotificacao === 'function') mostrarNotificacao('Comprimindo imagem...', 'info');
                    const options = {
                        maxSizeMB: 0.5,
                        maxWidthOrHeight: 1280,
                        useWebWorker: true
                    };
                    processedFile = await imageCompression(file, options);
                    customMetadata.compressed = 'true';
                    console.log(`✅ Imagem comprimida: ${(file.size/1024/1024).toFixed(2)}MB -> ${(processedFile.size/1024/1024).toFixed(2)}MB`);
                } else {
                    console.warn('⚠️ imageCompression não disponível. Enviando arquivo original.');
                }
            } catch (err) {
                console.error('Erro ao comprimir imagem, enviando original.', err);
            }
        }

        // Encapsulamento de segurança: Todo upload vai obrigatoriamente para a pasta da Empresa
        const safePath = `companies/${tenantId}/${path}_${Date.now()}_${processedFile.name}`;

        if (typeof mostrarNotificacao === 'function') mostrarNotificacao('Fazendo upload seguro do anexo...', 'info');
        
        try {
            const downloadUrl = await window.firebaseService.storage.upload(safePath, processedFile, { customMetadata });
            if (typeof mostrarNotificacao === 'function') mostrarNotificacao('Upload concluído com sucesso!', 'success');
            return downloadUrl;
        } catch (error) {
            console.error("Erro no upload para o Storage:", error);
            const classified = _classifyStorageError(error);
            if (typeof mostrarNotificacao === 'function') mostrarNotificacao(classified.message, 'error');
            throw error;
        }
    },

    async uploadFileWithPath(file, path) {
        if (!file) throw new Error("Nenhum arquivo providenciado.");
        const tenantId = window.firebaseService.getCurrentTenantId ? window.firebaseService.getCurrentTenantId() : null;
        if (!tenantId) throw new Error("Acesso negado: Tenant (Empresa) não identificado.");

        let processedFile = file;
        const customMetadata = {};
        if (file.type && file.type.startsWith('image/')) {
            try {
                if (typeof window.imageCompression === 'function') {
                    if (typeof mostrarNotificacao === 'function') mostrarNotificacao('Comprimindo imagem...', 'info');
                    const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1280, useWebWorker: true };
                    processedFile = await window.imageCompression(file, options);
                    customMetadata.compressed = 'true';
                } else if (typeof imageCompression === 'function') {
                    if (typeof mostrarNotificacao === 'function') mostrarNotificacao('Comprimindo imagem...', 'info');
                    const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1280, useWebWorker: true };
                    processedFile = await imageCompression(file, options);
                    customMetadata.compressed = 'true';
                }
            } catch (err) {
                console.error('Erro ao comprimir imagem, enviando original.', err);
            }
        }

        const safePath = `companies/${tenantId}/${path}_${Date.now()}_${processedFile.name}`;
        if (typeof mostrarNotificacao === 'function') mostrarNotificacao('Fazendo upload seguro do anexo...', 'info');
        try {
            const downloadUrl = await window.firebaseService.storage.upload(safePath, processedFile, { customMetadata });
            if (typeof mostrarNotificacao === 'function') mostrarNotificacao('Upload concluído com sucesso!', 'success');
            return { url: downloadUrl, storagePath: safePath };
        } catch (error) {
            console.error("Erro no upload para o Storage:", error);
            const classified = _classifyStorageError(error);
            if (typeof mostrarNotificacao === 'function') mostrarNotificacao(classified.message, 'error');
            throw error;
        }
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
