/**
 * 🧪 PERFORMANCE TESTER - SISTEMA DE TESTES DE PERFORMANCE
 * 
 * Testa e monitora a performance do dashboard em tempo real
 * Compara performance antes/depois das otimizações
 * 
 * 🎯 MÉTRICAS TESTADAS:
 * - Tempo de carregamento inicial
 * - Tempo de carregamento de dados
 * - Taxa de cache hit/miss
 * - Responsividade da interface
 * - Uso de memória
 * 
 * @version 1.0.0
 * @author Sistema Modular SISWEB
 */

class PerformanceTester {
    constructor() {
        this.config = {
            testIterations: 5,
            testKeys: ['romaneiosTL', 'romaneiosPct', 'clients', 'species'],
            performanceThresholds: {
                excellent: 100,  // < 100ms
                good: 300,       // < 300ms
                average: 800,    // < 800ms
                poor: 2000       // < 2s
            }
        };

        this.results = {
            loadingTimes: [],
            cachePerformance: {},
            hybridSyncMetrics: {},
            responsiveMetrics: {},
            memoryUsage: []
        };

        this.isTestingEnabled = false;
    }

    /**
     * 🚀 INICIAR TESTES DE PERFORMANCE
     */
    async runFullPerformanceTest() {
        console.log('🧪 Iniciando testes completos de performance...');
        
        const startTime = performance.now();
        
        try {
            // 1. Teste de carregamento inicial
            await this.testInitialLoadingTime();
            
            // 2. Teste de carregamento de dados
            await this.testDataLoadingPerformance();
            
            // 3. Teste de cache híbrido
            await this.testHybridCachePerformance();
            
            // 4. Teste de responsividade
            await this.testResponsivePerformance();
            
            // 5. Teste de memória
            await this.testMemoryUsage();
            
            const totalTime = performance.now() - startTime;
            
            // Gerar relatório
            const report = this.generatePerformanceReport(totalTime);
            
            console.log('📊 RELATÓRIO DE PERFORMANCE:');
            console.table(report.summary);
            
            return report;
            
        } catch (error) {
            console.error('❌ Erro nos testes de performance:', error);
            return null;
        }
    }

    /**
     * ⏱️ TESTE DE CARREGAMENTO INICIAL
     */
    async testInitialLoadingTime() {
        console.log('⏱️ Testando carregamento inicial...');
        
        const times = [];
        
        for (let i = 0; i < this.config.testIterations; i++) {
            const start = performance.now();
            
            // Simular carregamento inicial
            if (window.DashboardCore) {
                await window.DashboardCore.refresh();
            }
            
            const time = performance.now() - start;
            times.push(time);
            
            // Pequeno delay entre testes
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        this.results.loadingTimes = times;
        
        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        console.log(`⏱️ Tempo médio de carregamento: ${avgTime.toFixed(2)}ms`);
    }

    /**
     * 📊 TESTE DE PERFORMANCE DE CARREGAMENTO DE DADOS
     */
    async testDataLoadingPerformance() {
        console.log('📊 Testando carregamento de dados...');
        
        const results = {};
        
        for (const key of this.config.testKeys) {
            const times = [];
            
            for (let i = 0; i < this.config.testIterations; i++) {
                // Limpar cache para teste justo
                if (window.hybridSync) {
                    window.hybridSync.state.cache.delete(key);
                }
                
                const start = performance.now();
                
                if (window.hybridSync) {
                    await window.hybridSync.loadInstant(key);
                } else if (window.firebaseServiceTL) {
                    await window.firebaseServiceTL.loadData(key);
                }
                
                const time = performance.now() - start;
                times.push(time);
                
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            results[key] = {
                times: times,
                avg: times.reduce((a, b) => a + b, 0) / times.length,
                min: Math.min(...times),
                max: Math.max(...times)
            };
        }
        
        this.results.cachePerformance = results;
        
        console.log('📊 Performance de carregamento por chave:');
        Object.entries(results).forEach(([key, data]) => {
            console.log(`  ${key}: ${data.avg.toFixed(2)}ms (${data.min.toFixed(2)}-${data.max.toFixed(2)}ms)`);
        });
    }

    /**
     * ⚡ TESTE DE CACHE HÍBRIDO
     */
    async testHybridCachePerformance() {
        if (!window.hybridSync) {
            console.log('⚠️ Hybrid Sync não disponível para teste');
            return;
        }
        
        console.log('⚡ Testando performance do cache híbrido...');
        
        const metrics = window.hybridSync.getMetrics();
        this.results.hybridSyncMetrics = metrics;
        
        // Teste de benchmark específico
        const benchmarkResults = {};
        
        for (const key of this.config.testKeys) {
            try {
                const result = await window.hybridSync.benchmarkLoad(key, 10);
                benchmarkResults[key] = result;
            } catch (error) {
                console.warn(`⚠️ Erro no benchmark de ${key}:`, error);
            }
        }
        
        console.log('⚡ Benchmark do cache híbrido:');
        console.table(benchmarkResults);
        
        console.log('⚡ Métricas gerais do cache:');
        console.log(`  Taxa de Cache Hit: ${metrics.cacheHitRate}%`);
        console.log(`  Tempo médio de carregamento: ${metrics.avgLoadTime}ms`);
        console.log(`  Itens em cache: ${metrics.memoryCache}`);
        console.log(`  Fila de sync: ${metrics.queueSize}`);
    }

    /**
     * 📱 TESTE DE RESPONSIVIDADE
     */
    async testResponsivePerformance() {
        if (!window.responsiveManager) {
            console.log('⚠️ Responsive Manager não disponível para teste');
            return;
        }
        
        console.log('📱 Testando performance responsiva...');
        
        const deviceInfo = window.responsiveManager.getDeviceInfo();
        const state = window.responsiveManager.getState();
        
        this.results.responsiveMetrics = {
            deviceInfo,
            state,
            breakpointSwitchTime: await this.testBreakpointSwitching()
        };
        
        console.log('📱 Informações do dispositivo:');
        console.table(deviceInfo);
        
        console.log('📱 Estado responsivo:');
        console.table(state);
    }

    /**
     * 🔄 TESTE DE MUDANÇA DE BREAKPOINT
     */
    async testBreakpointSwitching() {
        const times = [];
        
        // Simular mudanças de viewport
        const testSizes = [480, 768, 992, 1200];
        
        for (const size of testSizes) {
            const start = performance.now();
            
            // Simular mudança de viewport
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: size,
            });
            
            // Disparar evento de resize
            window.dispatchEvent(new Event('resize'));
            
            // Aguardar processamento
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const time = performance.now() - start;
            times.push(time);
        }
        
        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        console.log(`🔄 Tempo médio de mudança de breakpoint: ${avgTime.toFixed(2)}ms`);
        
        return avgTime;
    }

    /**
     * 🧠 TESTE DE USO DE MEMÓRIA
     */
    async testMemoryUsage() {
        if (!performance.memory) {
            console.log('⚠️ API de memória não disponível');
            return;
        }
        
        console.log('🧠 Testando uso de memória...');
        
        const memoryBefore = {
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit
        };
        
        // Forçar carregamento de dados
        if (window.DashboardCore) {
            await window.DashboardCore.refresh();
        }
        
        // Aguardar processamento
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const memoryAfter = {
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit
        };
        
        const memoryDiff = {
            used: memoryAfter.used - memoryBefore.used,
            total: memoryAfter.total - memoryBefore.total
        };
        
        this.results.memoryUsage = {
            before: memoryBefore,
            after: memoryAfter,
            diff: memoryDiff
        };
        
        console.log('🧠 Uso de memória:');
        console.log(`  Antes: ${(memoryBefore.used / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  Depois: ${(memoryAfter.used / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  Diferença: ${(memoryDiff.used / 1024 / 1024).toFixed(2)} MB`);
    }

    /**
     * 📋 GERAR RELATÓRIO DE PERFORMANCE
     */
    generatePerformanceReport(totalTestTime) {
        const avgLoadTime = this.results.loadingTimes.reduce((a, b) => a + b, 0) / this.results.loadingTimes.length;
        
        const summary = {
            'Tempo de Carregamento Médio': `${avgLoadTime.toFixed(2)}ms`,
            'Classificação': this.getPerformanceRating(avgLoadTime),
            'Cache Hit Rate': this.results.hybridSyncMetrics.cacheHitRate ? `${this.results.hybridSyncMetrics.cacheHitRate}%` : 'N/A',
            'Dispositivo': this.results.responsiveMetrics.deviceInfo?.type || 'Desconhecido',
            'Breakpoint': this.results.responsiveMetrics.deviceInfo?.breakpoint || 'N/A',
            'Tempo Total de Teste': `${totalTestTime.toFixed(2)}ms`
        };
        
        const recommendations = this.generateRecommendations(avgLoadTime);
        
        return {
            summary,
            recommendations,
            rawData: this.results,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * ⭐ CLASSIFICAR PERFORMANCE
     */
    getPerformanceRating(avgTime) {
        if (avgTime < this.config.performanceThresholds.excellent) return '⭐⭐⭐⭐⭐ Excelente';
        if (avgTime < this.config.performanceThresholds.good) return '⭐⭐⭐⭐ Boa';
        if (avgTime < this.config.performanceThresholds.average) return '⭐⭐⭐ Média';
        if (avgTime < this.config.performanceThresholds.poor) return '⭐⭐ Ruim';
        return '⭐ Muito Ruim';
    }

    /**
     * 💡 GERAR RECOMENDAÇÕES
     */
    generateRecommendations(avgTime) {
        const recommendations = [];
        
        if (avgTime > this.config.performanceThresholds.good) {
            recommendations.push('🔧 Considere habilitar o modo de alta performance');
            recommendations.push('⚡ Verifique se o Hybrid Sync está funcionando corretamente');
        }
        
        if (this.results.hybridSyncMetrics.cacheHitRate < 80) {
            recommendations.push('📦 Taxa de cache baixa - considere aumentar o tempo de cache');
        }
        
        if (this.results.memoryUsage.diff?.used > 10 * 1024 * 1024) { // 10MB
            recommendations.push('🧠 Alto uso de memória detectado - considere limpeza de cache');
        }
        
        if (this.results.responsiveMetrics.deviceInfo?.type === 'mobile') {
            recommendations.push('📱 Dispositivo mobile - otimizações específicas aplicadas');
        }
        
        return recommendations;
    }

    /**
     * 🎯 TESTE RÁPIDO DE PERFORMANCE
     */
    async quickPerformanceTest() {
        console.log('🎯 Teste rápido de performance...');
        
        const start = performance.now();
        
        // Teste básico de carregamento
        if (window.DashboardCore) {
            await window.DashboardCore.refresh();
        }
        
        const time = performance.now() - start;
        const rating = this.getPerformanceRating(time);
        
        console.log(`🎯 Resultado: ${time.toFixed(2)}ms - ${rating}`);
        
        return { time, rating };
    }

    /**
     * 📊 MONITORAMENTO CONTÍNUO
     */
    startContinuousMonitoring() {
        if (this.isTestingEnabled) return;
        
        this.isTestingEnabled = true;
        console.log('📊 Monitoramento contínuo iniciado');
        
        // Teste a cada 5 minutos
        const interval = setInterval(async () => {
            if (!this.isTestingEnabled) {
                clearInterval(interval);
                return;
            }
            
            await this.quickPerformanceTest();
        }, 5 * 60 * 1000);
    }

    stopContinuousMonitoring() {
        this.isTestingEnabled = false;
        console.log('📊 Monitoramento contínuo parado');
    }
}

// 🌐 INSTÂNCIA GLOBAL
window.performanceTester = new PerformanceTester();

// 📤 FUNÇÕES DE CONVENIÊNCIA
window.testPerformance = () => window.performanceTester.runFullPerformanceTest();
window.quickTest = () => window.performanceTester.quickPerformanceTest();
window.startMonitoring = () => window.performanceTester.startContinuousMonitoring();
window.stopMonitoring = () => window.performanceTester.stopContinuousMonitoring();

console.log('🧪 Performance Tester carregado - Use testPerformance() para testar!');
