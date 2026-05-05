/**
 * Sistema de Cache Avançado - SISWEB
 * 
 * OTIMIZAÇÕES DE PERFORMANCE:
 * - Cache inteligente com TTL
 * - Lazy loading de dados
 * - Compressão de dados
 * - Paginação de resultados
 * - Cache em memória e localStorage
 */

class CacheSystem {
    constructor() {
        this.memoryCache = new Map();
        this.config = {
            defaultTTL: 5 * 60 * 1000, // 5 minutos
            maxMemorySize: 50 * 1024 * 1024, // 50MB
            compressionThreshold: 1024, // 1KB
            maxLocalStorageSize: 10 * 1024 * 1024 // 10MB
        };
        
        this.stats = {
            hits: 0,
            misses: 0,
            compressionSavings: 0
        };
        
        this.initializeCache();
    }
    
    /**
     * INICIALIZAÇÃO DO CACHE
     */
    initializeCache() {
        // Limpar cache expirado ao inicializar
        this.cleanExpiredCache();
        
        // Configurar limpeza periódica
        setInterval(() => {
            this.cleanExpiredCache();
        }, 60000); // A cada minuto
        
        console.log('🚀 Sistema de Cache inicializado');
    }
    
    /**
     * GERAÇÃO DE CHAVES
     */
    generateKey(key, params = {}) {
        const baseKey = String(key);
        if (Object.keys(params).length === 0) {
            return baseKey;
        }
        
        // Criar hash dos parâmetros para evitar chaves muito longas
        const paramString = JSON.stringify(params, Object.keys(params).sort());
        const hash = this.simpleHash(paramString);
        return `${baseKey}_${hash}`;
    }
    
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Converter para 32bit
        }
        return Math.abs(hash).toString(36);
    }
    
    /**
     * OPERAÇÕES DE CACHE PRINCIPAL
     */
    async set(key, data, ttl = null) {
        try {
            const actualTTL = ttl || this.config.defaultTTL;
            const expiresAt = Date.now() + actualTTL;
            
            // Comprimir dados se necessário
            const serializedData = JSON.stringify(data);
            const shouldCompress = serializedData.length > this.config.compressionThreshold;
            const processedData = shouldCompress ? this.compress(serializedData) : serializedData;
            
            const cacheEntry = {
                data: processedData,
                compressed: shouldCompress,
                expiresAt: expiresAt,
                size: serializedData.length,
                createdAt: Date.now()
            };
            
            // Armazenar em memória
            this.memoryCache.set(key, cacheEntry);
            
            // Armazenar em localStorage se não for muito grande
            if (this.getLocalStorageUsage() + serializedData.length < this.config.maxLocalStorageSize) {
                try {
                    localStorage.setItem(`cache_${key}`, JSON.stringify(cacheEntry));
                } catch (e) {
                    console.warn('Cache localStorage cheio, limpando dados antigos');
                    this.cleanOldLocalStorageCache();
                }
            }
            
            // Verificar limite de memória
            this.checkMemoryLimit();
            
            if (shouldCompress) {
                this.stats.compressionSavings += serializedData.length - processedData.length;
            }
            
            return true;
        } catch (error) {
            console.error('Erro ao definir cache:', error);
            return false;
        }
    }
    
    async get(key) {
        try {
            // Tentar buscar na memória primeiro
            let cacheEntry = this.memoryCache.get(key);
            
            // Se não estiver na memória, tentar localStorage
            if (!cacheEntry) {
                const localData = localStorage.getItem(`cache_${key}`);
                if (localData) {
                    cacheEntry = JSON.parse(localData);
                    // Restaurar na memória
                    this.memoryCache.set(key, cacheEntry);
                }
            }
            
            if (!cacheEntry) {
                this.stats.misses++;
                return null;
            }
            
            // Verificar expiração
            if (Date.now() > cacheEntry.expiresAt) {
                this.delete(key);
                this.stats.misses++;
                return null;
            }
            
            this.stats.hits++;
            
            // Descomprimir se necessário
            const data = cacheEntry.compressed ? 
                this.decompress(cacheEntry.data) : 
                cacheEntry.data;
            
            return JSON.parse(data);
        } catch (error) {
            console.error('Erro ao buscar cache:', error);
            this.stats.misses++;
            return null;
        }
    }
    
    delete(key) {
        this.memoryCache.delete(key);
        localStorage.removeItem(`cache_${key}`);
    }
    
    /**
     * CACHE COM LAZY LOADING
     */
    async getOrSet(key, fetchFunction, ttl = null, params = {}) {
        const cacheKey = this.generateKey(key, params);
        
        // Tentar buscar do cache
        let data = await this.get(cacheKey);
        
        if (data !== null) {
            return data;
        }
        
        // Se não estiver no cache, buscar dados
        try {
            data = await fetchFunction(params);
            await this.set(cacheKey, data, ttl);
            return data;
        } catch (error) {
            console.error('Erro ao buscar dados para cache:', error);
            throw error;
        }
    }
    
    /**
     * PAGINAÇÃO DE CACHE
     */
    async getPaginatedData(key, page = 1, pageSize = 20, fetchFunction = null) {
        const allDataKey = `${key}_all`;
        const pageKey = `${key}_page_${page}_${pageSize}`;
        
        // Tentar buscar página específica do cache
        let pageData = await this.get(pageKey);
        if (pageData) {
            return pageData;
        }
        
        // Tentar buscar todos os dados do cache
        let allData = await this.get(allDataKey);
        
        // Se não tiver dados, buscar
        if (!allData && fetchFunction) {
            allData = await fetchFunction();
            await this.set(allDataKey, allData);
        }
        
        if (!allData) {
            return { items: [], totalPages: 0, currentPage: page, pageSize: pageSize };
        }
        
        // Paginar dados
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const items = allData.slice(startIndex, endIndex);
        const totalPages = Math.ceil(allData.length / pageSize);
        
        pageData = {
            items: items,
            totalPages: totalPages,
            currentPage: page,
            pageSize: pageSize,
            totalItems: allData.length
        };
        
        // Cachear página específica
        await this.set(pageKey, pageData, this.config.defaultTTL / 2); // TTL menor para páginas
        
        return pageData;
    }
    
    /**
     * COMPRESSÃO SIMPLES
     */
    compress(data) {
        // Compressão básica usando repetição de caracteres
        return data.replace(/(.)\1{3,}/g, (match, char) => {
            return `${char}*${match.length}`;
        });
    }
    
    decompress(data) {
        // Descompressão
        return data.replace(/(.)\*(\d+)/g, (match, char, count) => {
            return char.repeat(parseInt(count));
        });
    }
    
    /**
     * LIMPEZA E MANUTENÇÃO
     */
    cleanExpiredCache() {
        const now = Date.now();
        let cleanedCount = 0;
        
        // Limpar cache em memória
        for (const [key, entry] of this.memoryCache.entries()) {
            if (now > entry.expiresAt) {
                this.memoryCache.delete(key);
                cleanedCount++;
            }
        }
        
        // Limpar localStorage
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && key.startsWith('cache_')) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (data && now > data.expiresAt) {
                        localStorage.removeItem(key);
                        cleanedCount++;
                    }
                } catch (e) {
                    // Remove dados corrompidos
                    localStorage.removeItem(key);
                    cleanedCount++;
                }
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`🧹 Cache limpo: ${cleanedCount} entradas removidas`);
        }
    }
    
    checkMemoryLimit() {
        const currentSize = this.getMemoryCacheSize();
        if (currentSize > this.config.maxMemorySize) {
            this.evictLRU();
        }
    }
    
    evictLRU() {
        // Remover entradas menos recentemente usadas
        const entries = Array.from(this.memoryCache.entries());
        entries.sort((a, b) => a[1].createdAt - b[1].createdAt);
        
        // Remover 25% das entradas mais antigas
        const toRemove = Math.ceil(entries.length * 0.25);
        for (let i = 0; i < toRemove; i++) {
            this.memoryCache.delete(entries[i][0]);
        }
        
        console.log(`📦 Cache LRU: ${toRemove} entradas removidas`);
    }
    
    cleanOldLocalStorageCache() {
        const cacheEntries = [];
        
        // Coletar todas as entradas de cache
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('cache_')) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    cacheEntries.push({ key, data });
                } catch (e) {
                    localStorage.removeItem(key);
                }
            }
        }
        
        // Ordenar por data de criação
        cacheEntries.sort((a, b) => a.data.createdAt - b.data.createdAt);
        
        // Remover 50% das entradas mais antigas
        const toRemove = Math.ceil(cacheEntries.length * 0.5);
        for (let i = 0; i < toRemove; i++) {
            localStorage.removeItem(cacheEntries[i].key);
        }
        
        console.log(`💾 localStorage limpo: ${toRemove} entradas removidas`);
    }
    
    /**
     * UTILITÁRIOS E ESTATÍSTICAS
     */
    getMemoryCacheSize() {
        let totalSize = 0;
        for (const entry of this.memoryCache.values()) {
            totalSize += entry.size;
        }
        return totalSize;
    }
    
    getLocalStorageUsage() {
        let total = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += localStorage[key].length;
            }
        }
        return total;
    }
    
    getStats() {
        const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) * 100;
        
        return {
            hits: this.stats.hits,
            misses: this.stats.misses,
            hitRate: isNaN(hitRate) ? 0 : hitRate.toFixed(2),
            memoryEntries: this.memoryCache.size,
            memorySizeKB: (this.getMemoryCacheSize() / 1024).toFixed(2),
            localStorageSizeKB: (this.getLocalStorageUsage() / 1024).toFixed(2),
            compressionSavingsKB: (this.stats.compressionSavings / 1024).toFixed(2)
        };
    }
    
    clear() {
        this.memoryCache.clear();
        
        // Limpar apenas entradas de cache do localStorage
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && key.startsWith('cache_')) {
                localStorage.removeItem(key);
            }
        }
        
        this.stats = { hits: 0, misses: 0, compressionSavings: 0 };
        console.log('🗑️ Cache completamente limpo');
    }
    
    /**
     * INVALIDAÇÃO INTELIGENTE
     */
    invalidatePattern(pattern) {
        const regex = new RegExp(pattern);
        const keysToDelete = [];
        
        // Cache em memória
        for (const key of this.memoryCache.keys()) {
            if (regex.test(key)) {
                keysToDelete.push(key);
            }
        }
        
        // localStorage
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('cache_')) {
                const cacheKey = key.substring(6); // Remove 'cache_'
                if (regex.test(cacheKey)) {
                    keysToDelete.push(cacheKey);
                }
            }
        }
        
        // Deletar chaves encontradas
        keysToDelete.forEach(key => this.delete(key));
        
        console.log(`🎯 Invalidação por padrão: ${keysToDelete.length} entradas removidas`);
        return keysToDelete.length;
    }
}

/**
 * LAZY LOADING COMPONENT
 */
class LazyLoader {
    constructor(cacheSystem) {
        this.cache = cacheSystem;
        this.loadingStates = new Map();
        this.observers = new Map();
    }
    
    /**
     * CARREGAR DADOS COM LAZY LOADING
     */
    async loadWhenVisible(element, key, fetchFunction, options = {}) {
        const { threshold = 0.1, rootMargin = '50px' } = options;
        
        return new Promise((resolve) => {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(async (entry) => {
                    if (entry.isIntersecting) {
                        observer.unobserve(element);
                        
                        try {
                            this.setLoadingState(key, true);
                            const data = await this.cache.getOrSet(key, fetchFunction);
                            resolve(data);
                        } catch (error) {
                            console.error('Erro no lazy loading:', error);
                            resolve(null);
                        } finally {
                            this.setLoadingState(key, false);
                        }
                    }
                });
            }, { threshold, rootMargin });
            
            observer.observe(element);
            this.observers.set(key, observer);
        });
    }
    
    /**
     * CARREGAMENTO PROGRESSIVO DE LISTAS
     */
    async loadProgressively(container, itemsKey, renderFunction, options = {}) {
        const { 
            pageSize = 20, 
            loadMore = true,
            threshold = 0.8 
        } = options;
        
        let currentPage = 1;
        let hasMore = true;
        
        const loadPage = async () => {
            if (!hasMore) return;
            
            this.setLoadingState(itemsKey, true);
            
            try {
                const pageData = await this.cache.getPaginatedData(
                    itemsKey, 
                    currentPage, 
                    pageSize
                );
                
                if (pageData.items.length === 0 || currentPage >= pageData.totalPages) {
                    hasMore = false;
                }
                
                // Renderizar itens
                pageData.items.forEach(item => {
                    const element = renderFunction(item);
                    container.appendChild(element);
                });
                
                currentPage++;
                
                // Configurar carregamento automático se habilitado
                if (loadMore && hasMore) {
                    this.setupAutoLoad(container, loadPage, threshold);
                }
                
            } catch (error) {
                console.error('Erro no carregamento progressivo:', error);
                hasMore = false;
            } finally {
                this.setLoadingState(itemsKey, false);
            }
        };
        
        // Carregar primeira página
        await loadPage();
        
        return {
            loadMore: loadPage,
            hasMore: () => hasMore,
            currentPage: () => currentPage - 1
        };
    }
    
    setupAutoLoad(container, loadFunction, threshold) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    loadFunction();
                }
            });
        }, { threshold });
        
        // Observar o último elemento
        const lastChild = container.lastElementChild;
        if (lastChild) {
            observer.observe(lastChild);
        }
    }
    
    setLoadingState(key, isLoading) {
        this.loadingStates.set(key, isLoading);
        
        // Disparar evento personalizado
        const event = new CustomEvent('loadingStateChange', {
            detail: { key, isLoading }
        });
        document.dispatchEvent(event);
    }
    
    isLoading(key) {
        return this.loadingStates.get(key) || false;
    }
    
    cleanup() {
        // Limpar todos os observers
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();
        this.loadingStates.clear();
    }
}

// Instâncias globais
const cacheSystem = new CacheSystem();
const lazyLoader = new LazyLoader(cacheSystem);

// Exportar para uso global
window.CacheSystem = CacheSystem;
window.LazyLoader = LazyLoader;
window.cacheSystem = cacheSystem;
window.lazyLoader = lazyLoader;

// Adicionar comando para debugar cache
window.debugCache = () => {
    console.log('📊 Estatísticas do Cache:', cacheSystem.getStats());
    console.log('🔧 Comandos disponíveis:');
    console.log('- cacheSystem.clear() - Limpar todo o cache');
    console.log('- cacheSystem.getStats() - Ver estatísticas');
    console.log('- cacheSystem.invalidatePattern("pattern") - Invalidar por padrão');
};

console.log('⚡ Sistema de Cache Avançado carregado');
console.log('💡 Digite debugCache() no console para ver estatísticas'); 