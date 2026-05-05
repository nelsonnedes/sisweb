/**
 * 🧪 SAMPLE DATA GENERATOR - GERADOR DE DADOS DE EXEMPLO
 * 
 * Gera dados de exemplo para demonstrar o dashboard
 * com funcionários, folha de pagamento e contas financeiras
 * 
 * @version 1.0.0
 * @author Sistema Modular SISWEB
 */

class SampleDataGenerator {
    constructor() {
        this.funcionarios = [];
        this.lancamentos = [];
        this.contasPagar = [];
        this.contasReceber = [];
    }

    resolveCompanyId() {
        try {
            const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
            if (svc && typeof svc.getTenantId === 'function') {
                const t = svc.getTenantId();
                if (t) return String(t);
            }
        } catch (_) {}
        try {
            if (window.appTenantId) return String(window.appTenantId);
            if (window.companyInfo) {
                const raw = window.companyInfo;
                const id = raw.id || raw.companyId || raw.slug || raw.nome || raw.name;
                if (id) return String(id);
            }
            const stored = localStorage.getItem('company_info');
            if (stored) {
                const obj = JSON.parse(stored);
                const id = obj && (obj.id || obj.companyId || obj.slug || obj.nome || obj.name);
                if (id) return String(id);
            }
        } catch (_) {}
        return null;
    }

    getLocalStorageKeys(key) {
        const keys = [];
        try {
            const base = String(key || '');
            if (!base) return keys;
            const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
            if (svc && typeof svc.getNamespacedPath === 'function') {
                const ns = svc.getNamespacedPath(base);
                if (ns && ns !== base) keys.push(ns);
            } else {
                const companyId = this.resolveCompanyId();
                if (companyId && !/^companies\//.test(base) && !/^users\//.test(base)) {
                    keys.push(`companies/${companyId}/${base}`);
                }
            }
            keys.push(base);
        } catch (_) {}
        return [...new Set(keys)];
    }

    readLocalStorageValue(key) {
        for (const k of this.getLocalStorageKeys(key)) {
            const val = localStorage.getItem(k);
            if (val) return val;
        }
        return null;
    }

    writeLocalStorageValue(key, data) {
        try {
            if (window.SiswebStorage && typeof window.SiswebStorage.write === 'function') {
                window.SiswebStorage.write(key, data);
                return;
            }
        } catch (_) {}
        const payload = typeof data === 'string' ? data : JSON.stringify(data);
        for (const k of this.getLocalStorageKeys(key)) {
            localStorage.setItem(k, payload);
        }
    }

    /**
     * 🏭 GERAR DADOS COMPLETOS DE EXEMPLO
     */
    generateSampleData() {
        console.log('🧪 Gerando dados de exemplo...');
        
        this.generateFuncionarios();
        this.generateLancamentosFolha();
        this.generateContasFinanceiras();
        
        return {
            funcionarios: this.funcionarios,
            lancamentos: this.lancamentos,
            contasPagar: this.contasPagar,
            contasReceber: this.contasReceber
        };
    }

    /**
     * 🏭 GERAR DADOS CORE (FUNCIONÁRIOS + FOLHAS) SEM FINANCEIRO
     */
    generateSampleCore() {
        console.log('🧪 Gerando dados de exemplo (core: funcionários + folhas)...');
        // Reset arrays
        this.funcionarios = []; this.lancamentos = [];
        // Gerar apenas funcionários e folhas
        this.generateFuncionarios();
        this.generateLancamentosFolha();
        return {
            funcionarios: this.funcionarios,
            lancamentos: this.lancamentos
        };
    }

    /**
     * 👥 GERAR FUNCIONÁRIOS DE EXEMPLO
     */
    generateFuncionarios() {
        const nomes = [
            'João Silva Santos', 'Maria Oliveira Costa', 'Pedro Souza Lima',
            'Ana Carolina Ferreira', 'Carlos Eduardo Pereira', 'Juliana Santos Rodrigues',
            'Roberto Carlos Almeida', 'Fernanda Lima Barbosa', 'Marcos Antonio Silva',
            'Patrícia Gomes Nascimento', 'André Luis Martins', 'Camila Ribeiro Santos',
            'Ricardo Henrique Costa', 'Luciana Pereira Oliveira', 'Felipe Santos Cardoso',
            'Gabriela Alves Cunha', 'Daniel Rodrigues Sousa', 'Renata Silva Campos',
            'Thiago Oliveira Ramos', 'Vanessa Costa Barbosa', 'Bruno Ferreira Lima',
            'Aline Santos Pereira', 'Gustavo Lima Rodrigues', 'Priscila Gomes Silva'
        ];

        const cargos = [
            'Operador de Máquina', 'Motorista', 'Auxiliar de Produção', 'Supervisor',
            'Técnico Florestal', 'Analista Administrativo', 'Gerente de Operações',
            'Assistente Contábil', 'Coordenador de Logística', 'Operador de Empilhadeira',
            'Técnico de Segurança', 'Auxiliar Administrativo'
        ];

        for (let i = 0; i < 24; i++) {
            const funcionario = {
                id: `func_${i + 1}`,
                nome: nomes[i],
                cargo: cargos[i % cargos.length],
                cpf: this.generateCPF(),
                salario: this.generateSalario(),
                dataAdmissao: this.generateDataAdmissao(),
                status: 'ativo',
                setor: this.generateSetor(),
                timestamp: Date.now() - (i * 24 * 60 * 60 * 1000) // Datas diferentes
            };
            
            this.funcionarios.push(funcionario);
        }

        console.log(`👥 Gerados ${this.funcionarios.length} funcionários`);
    }

    /**
     * 💰 GERAR LANÇAMENTOS DA FOLHA DE PAGAMENTO
     */
    generateLancamentosFolha() {
        const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho'];
        
        this.funcionarios.forEach(funcionario => {
            meses.forEach((mes, index) => {
                const salarioBruto = funcionario.salario;
                const descontos = salarioBruto * 0.15; // 15% de descontos
                const salarioLiquido = salarioBruto - descontos;
                const quinzenaValor = salarioLiquido * 0.4; // 40% na quinzena
                
                const lancamento = {
                    id: `lanc_${funcionario.id}_${index}`,
                    funcionarioId: funcionario.id,
                    funcionarioNome: funcionario.nome,
                    mes: mes,
                    ano: 2024,
                    salarioBruto: salarioBruto,
                    descontos: descontos,
                    valorLiquido: salarioLiquido,
                    salarioLiquido: salarioLiquido,
                    quinzenaValor: quinzenaValor,
                    quinzenaPercentual: 40,
                    dataProcessamento: new Date(2024, index, 15).getTime(),
                    status: 'processado'
                };
                
                this.lancamentos.push(lancamento);
            });
        });

        console.log(`💰 Gerados ${this.lancamentos.length} lançamentos de folha`);
    }

    /**
     * 🏦 GERAR CONTAS FINANCEIRAS
     */
    generateContasFinanceiras() {
        // Contas a Pagar
        const fornecedores = [
            'Posto de Combustível Ltda', 'Oficina Mecânica Silva',
            'Distribuidora de Peças Auto', 'Empresa de Manutenção',
            'Fornecedor de Equipamentos', 'Serviços de Transporte'
        ];

        for (let i = 0; i < 15; i++) {
            const conta = {
                id: `cp_${i + 1}`,
                descricao: `Pagamento - ${fornecedores[i % fornecedores.length]}`,
                valor: this.generateValorConta(),
                dataVencimento: this.generateDataVencimento(),
                status: i < 5 ? 'pago' : 'pendente',
                categoria: 'compras',
                tipo: 'pagar',
                fornecedor: fornecedores[i % fornecedores.length]
            };
            
            this.contasPagar.push(conta);
        }

        // Contas a Receber
        const clientes = [
            'Madeireira São Paulo Ltda', 'Construtora Central',
            'Serraria do Norte', 'Móveis e Decorações',
            'Exportadora de Madeiras', 'Indústria de Compensados'
        ];

        for (let i = 0; i < 12; i++) {
            const conta = {
                id: `cr_${i + 1}`,
                descricao: `Venda - ${clientes[i % clientes.length]}`,
                valor: this.generateValorVenda(),
                dataVencimento: this.generateDataVencimento(),
                status: i < 3 ? 'recebido' : 'pendente',
                categoria: 'vendas',
                tipo: 'receber',
                cliente: clientes[i % clientes.length]
            };
            
            this.contasReceber.push(conta);
        }

        console.log(`🏦 Geradas ${this.contasPagar.length} contas a pagar e ${this.contasReceber.length} contas a receber`);
    }

    /**
     * 🔧 MÉTODOS AUXILIARES
     */
    generateCPF() {
        const nums = Array.from({length: 11}, () => Math.floor(Math.random() * 10));
        return nums.join('').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }

    generateSalario() {
        const salarios = [1500, 1800, 2200, 2800, 3500, 4200, 5000, 6500, 8000, 12000];
        return salarios[Math.floor(Math.random() * salarios.length)];
    }

    generateDataAdmissao() {
        const anos = [2020, 2021, 2022, 2023, 2024];
        const ano = anos[Math.floor(Math.random() * anos.length)];
        const mes = Math.floor(Math.random() * 12);
        const dia = Math.floor(Math.random() * 28) + 1;
        return new Date(ano, mes, dia).getTime();
    }

    generateSetor() {
        const setores = ['Produção', 'Administrativo', 'Logística', 'Manutenção', 'Segurança'];
        return setores[Math.floor(Math.random() * setores.length)];
    }

    generateValorConta() {
        return Math.floor(Math.random() * 5000) + 500; // Entre R$ 500 e R$ 5.500
    }

    generateValorVenda() {
        return Math.floor(Math.random() * 15000) + 2000; // Entre R$ 2.000 e R$ 17.000
    }

    generateDataVencimento() {
        const hoje = new Date();
        const diasFuturos = Math.floor(Math.random() * 60) - 30; // Entre -30 e +30 dias
        const dataVencimento = new Date(hoje.getTime() + (diasFuturos * 24 * 60 * 60 * 1000));
        return dataVencimento.getTime();
    }

    /**
     * 💾 SALVAR DADOS NO LOCALSTORAGE
     */
    async saveSampleDataToLocalStorage() {
        const data = this.generateSampleData();
        
        try {
            // Salvar funcionários
            this.writeLocalStorageValue('funcionarios_folha', JSON.stringify(data.funcionarios));
            
            // Salvar lançamentos
            this.writeLocalStorageValue('lancamentos_folha', JSON.stringify(data.lancamentos));
            this.writeLocalStorageValue('folhas', JSON.stringify(data.lancamentos));
            
            // ✅ UNIFICAÇÃO: Usar nomes padronizados (sem underscore)
            this.writeLocalStorageValue('contasPagar', JSON.stringify(data.contasPagar));
            this.writeLocalStorageValue('contasReceber', JSON.stringify(data.contasReceber));
            
            console.log('💾 Dados de exemplo salvos no localStorage');
            
            // Se Hybrid Sync disponível, forçar atualização do cache
            if (window.hybridSync) {
                window.hybridSync.state.cache.clear();
                console.log('🔄 Cache híbrido limpo para recarregar dados');
            }
            
            return true;
        } catch (error) {
            console.error('❌ Erro ao salvar dados de exemplo:', error);
            return false;
        }
    }

    /**
     * 💾 SALVAR DADOS NO FIREBASE
     */
    async saveSampleDataToFirebase() {
        if (!window.firebaseServiceTL) {
            console.warn('⚠️ Firebase service não disponível');
            return false;
        }

        const data = this.generateSampleData();
        
        try {
            await Promise.all([
                window.firebaseServiceTL.saveData('funcionarios_folha', data.funcionarios),
                window.firebaseServiceTL.saveData('lancamentos_folha', data.lancamentos),
                window.firebaseServiceTL.saveData('folhas', data.lancamentos),
                window.firebaseServiceTL.saveData('financas/pagar', data.contasPagar),
                window.firebaseServiceTL.saveData('financas/receber', data.contasReceber)
            ]);
            
            console.log('🔥 Dados de exemplo salvos no Firebase');
            return true;
        } catch (error) {
            console.error('❌ Erro ao salvar dados no Firebase:', error);
            return false;
        }
    }

    /**
     * 💾 SALVAR DADOS CORE (FUNCIONÁRIOS + FOLHAS) NO LOCALSTORAGE
     */
    async saveSampleCoreToLocalStorage() {
        const data = this.generateSampleCore();
        try {
            this.writeLocalStorageValue('funcionarios_folha', JSON.stringify(data.funcionarios));
            this.writeLocalStorageValue('lancamentos_folha', JSON.stringify(data.lancamentos));
            this.writeLocalStorageValue('folhas', JSON.stringify(data.lancamentos));
            console.log('💾 Dados core de exemplo salvos no localStorage');
            if (window.hybridSync) { window.hybridSync.state.cache.clear(); }
            return true;
        } catch (error) {
            console.error('❌ Erro ao salvar dados core de exemplo:', error);
            return false;
        }
    }

    /**
     * 💾 SALVAR DADOS CORE (FUNCIONÁRIOS + FOLHAS) NO FIREBASE
     */
    async saveSampleCoreToFirebase() {
        if (!window.firebaseServiceTL) { console.warn('⚠️ Firebase service não disponível'); return false; }
        const data = this.generateSampleCore();
        try {
            await Promise.all([
                window.firebaseServiceTL.saveData('funcionarios_folha', data.funcionarios),
                window.firebaseServiceTL.saveData('lancamentos_folha', data.lancamentos),
                window.firebaseServiceTL.saveData('folhas', data.lancamentos)
            ]);
            console.log('🔥 Dados core de exemplo salvos no Firebase');
            return true;
        } catch (error) {
            console.error('❌ Erro ao salvar dados core no Firebase:', error);
            return false;
        }
    }

    /**
     * 🎯 GERAR E SALVAR DADOS CORE
     */
    async generateAndSaveCore() {
        console.log('🚀 Gerando e salvando dados core...');
        await this.saveSampleCoreToLocalStorage();
        setTimeout(async () => { await this.saveSampleCoreToFirebase(); }, 1000);
        if (window.DashboardCore) { setTimeout(() => { window.DashboardCore.refresh?.(); }, 2000); }
        return true;
    }

    /**
     * 🎯 GERAR E SALVAR DADOS COMPLETOS
     */
    async generateAndSaveAll() {
        console.log('🚀 Gerando e salvando dados completos...');
        
        // Salvar no localStorage primeiro (instantâneo)
        await this.saveSampleDataToLocalStorage();
        
        // Salvar no Firebase em background
        setTimeout(async () => {
            await this.saveSampleDataToFirebase();
        }, 1000);
        
        // Recarregar dashboard se disponível
        if (window.DashboardCore) {
            setTimeout(() => {
                window.DashboardCore.refresh();
            }, 2000);
        }
        
        return true;
    }

    /**
     * 🧹 PURGE FINANCE SAMPLES (Receber/Pagar) - SAFE MODE
     */
    async purgeFinanceSamples() {
        try {
            const sampleClients = [
                'Madeireira São Paulo Ltda', 'Construtora Central',
                'Serraria do Norte', 'Móveis e Decorações',
                'Exportadora de Madeiras', 'Indústria de Compensados'
            ].map(s => s.toLowerCase());
            const sampleSuppliers = [
                'Posto de Combustível Ltda', 'Oficina Mecânica Silva',
                'Distribuidora de Peças Auto', 'Empresa de Manutenção',
                'Fornecedor de Equipamentos', 'Serviços de Transporte'
            ].map(s => s.toLowerCase());
            const norm = s => String(s||'').toLowerCase().trim();

            const isSampleReceber = (c) => {
                const desc = norm(c && c.descricao);
                const cliente = norm(c && (c.cliente || (c.cliente && c.cliente.nome)));
                const cat = norm(c && c.categoria);
                const id = String(c && c.id || '');
                const origemId = c && c.origemId;
                const matchDesc = desc.startsWith('venda - ') && sampleClients.some(n => desc === `venda - ${n}`);
                const matchCliente = sampleClients.includes(cliente);
                const idGen = id.startsWith('cr_');
                return (idGen || matchDesc || matchCliente) && cat === 'vendas' && !origemId;
            };
            const isSamplePagar = (c) => {
                const desc = norm(c && c.descricao);
                const forn = norm(c && (c.fornecedor || (c.fornecedor && c.fornecedor.nome)));
                const cat = norm(c && c.categoria);
                const id = String(c && c.id || '');
                const origemId = c && c.origemId;
                const matchDesc = desc.startsWith('pagamento - ') && sampleSuppliers.some(n => desc === `pagamento - ${n}`);
                const matchForn = sampleSuppliers.includes(forn);
                const idGen = id.startsWith('cp_');
                return (idGen || matchDesc || matchForn) && cat === 'operacional' && !origemId;
            };

            // LocalStorage purge
            try {
                const crLocal = JSON.parse(this.readLocalStorageValue('contasReceber') || '[]');
                const cpLocal = JSON.parse(this.readLocalStorageValue('contasPagar') || '[]');
                const crKeep = (Array.isArray(crLocal) ? crLocal : []).filter(c => !isSampleReceber(c));
                const cpKeep = (Array.isArray(cpLocal) ? cpLocal : []).filter(c => !isSamplePagar(c));
                this.writeLocalStorageValue('contasReceber', JSON.stringify(crKeep));
                this.writeLocalStorageValue('contasPagar', JSON.stringify(cpKeep));
                console.log(`🧹 Local: removidas ${(crLocal.length - crKeep.length)} contasReceber e ${(cpLocal.length - cpKeep.length)} contasPagar de amostra`);
            } catch (e) { console.warn('⚠️ Purge local falhou:', e); }

            // Firebase purge
            if (window.firebaseService && typeof window.firebaseService.updatePaths === 'function') {
                try {
                    const updates = {};
                    const crAll = await (async ()=>{ try { const r = await window.firebaseService.loadFromFirebase('financas/receber'); if (r && r.success && r.data) { return Array.isArray(r.data)? r.data : Object.keys(r.data).map(k=>({ id:k, ...r.data[k] })); } } catch(_){} return []; })();
                    const cpAll = await (async ()=>{ try { const r = await window.firebaseService.loadFromFirebase('financas/pagar'); if (r && r.success && r.data) { return Array.isArray(r.data)? r.data : Object.keys(r.data).map(k=>({ id:k, ...r.data[k] })); } } catch(_){} return []; })();
                    (crAll||[]).forEach(c => { if (isSampleReceber(c) && c.id) updates[`financas/receber/${String(c.id)}`] = null; });
                    (cpAll||[]).forEach(c => { if (isSamplePagar(c) && c.id) updates[`financas/pagar/${String(c.id)}`] = null; });
                    const count = Object.keys(updates).length;
                    if (count > 0) {
                        await window.firebaseService.updatePaths(updates);
                        console.log(`🔥 Firebase: removidas ${count} entradas de amostra (Receber/Pagar)`);
                    } else {
                        console.log('ℹ️ Firebase: nenhuma amostra detectada para remover');
                    }
                } catch (e) { console.warn('⚠️ Purge firebase falhou:', e); }
            }
            return true;
        } catch (e) {
            console.error('❌ Falha no purge de amostras:', e);
            return false;
        }
    }

    async purgeSampleFolhas() {
        try {
            const norm = s => String(s||'').toLowerCase().trim();
            const isSampleFolha = (f) => {
                const id = String(f && (f.id || f.key || f.$key) || '');
                const funcionarioNome = norm(f && f.funcionario && (f.funcionario.nome || f.funcionario));
                const ano = String(f && (f.ano || '') || '').trim();
                const mesAno = String(f && (f.mesAno || '') || '').trim();
                const hasQP = !!(f && (f.quinzenaPercentual || f.quinzenaValor));
                const idGen = id.startsWith('lanc_');
                const is2024 = ano === '2024' || mesAno.startsWith('2024-');
                return idGen || (hasQP && is2024);
            };
            const purgeList = async (keyPath) => {
                const all = await (async ()=>{ try { const r = await window.firebaseService.loadFromFirebase(keyPath); if (r && r.success && r.data) { return Array.isArray(r.data)? r.data : Object.keys(r.data).map(k=>({ id:k, ...r.data[k] })); } } catch(_){} return []; })();
                const cuts = (all||[]).filter(isSampleFolha);
                if (window.firebaseService && typeof window.firebaseService.updatePaths === 'function') {
                    const updates = {}; cuts.forEach(c => { if (c && c.id) updates[`${keyPath}/${String(c.id)}`] = null; });
                    if (Object.keys(updates).length > 0) await window.firebaseService.updatePaths(updates);
                }
                return cuts.length;
            };
            const removed = await purgeList('folhas');
            console.log(`🔥 Folhas: removidas ${removed} entradas de amostra`);
            return true;
        } catch (e) { console.error('❌ Falha no purge de folhas de amostra:', e); return false; }
    }

    async previewSampleEmployees() {
        try {
            const sampleNames = [
                'João Silva Santos','Maria Oliveira Costa','Pedro Souza Lima','Ana Carolina Ferreira','Carlos Eduardo Pereira','Juliana Santos Rodrigues','Roberto Carlos Almeida','Fernanda Lima Barbosa','Marcos Antonio Silva','Patrícia Gomes Nascimento','André Luis Martins','Camila Ribeiro Santos','Ricardo Henrique Costa','Luciana Pereira Oliveira','Felipe Santos Cardoso','Gabriela Alves Cunha','Daniel Rodrigues Sousa','Renata Silva Campos','Thiago Oliveira Ramos','Vanessa Costa Barbosa','Bruno Ferreira Lima','Aline Santos Pereira','Gustavo Lima Rodrigues','Priscila Gomes Silva'
            ].map(s=>s.toLowerCase());
            const norm = s => String(s||'').toLowerCase().trim();
            const isSampleId = (id) => String(id||'').startsWith('func_');
            const isSampleName = (nome) => sampleNames.includes(norm(nome));
            const isLikelySample = (emp) => {
                const id = String(emp && emp.id || '');
                const nome = String(emp && emp.nome || '');
                const hasSalarioProp = emp && emp.salario != null;
                const missingBase = !(emp && emp.salarioBase != null);
                const missingContrato = !(emp && (emp.tipoContrato || emp.funcionarioTipoContrato));
                return (isSampleId(id) || isSampleName(nome) || (hasSalarioProp && missingBase && missingContrato));
            };
            const hasRealReferences = async (empId) => {
                try {
                    const folhasAll = await (async ()=>{ try { const r = await window.firebaseService.loadFromFirebase('folhas'); if (r && r.success && r.data) { return Array.isArray(r.data)? r.data : Object.keys(r.data).map(k=>({ id:k, ...r.data[k] })); } } catch(_){} return []; })();
                    const refs = (folhasAll||[]).filter(f => String(f && f.funcionario && f.funcionario.id) === String(empId));
                    return refs.some(f => { const id = String(f && (f.id||'')); const ano = String(f && (f.ano||'')||''); const mesAno = String(f && (f.mesAno||'')||''); return !(id.startsWith('lanc_') || ano==='2024' || mesAno.startsWith('2024-')); });
                } catch(_) { return false; }
            };
            const local = JSON.parse(this.readLocalStorageValue('funcionarios_folha')||'[]');
            const remote = await (async ()=>{ try { const r = await window.firebaseService.loadFromFirebase('funcionarios'); if (r && r.success && r.data) { return Array.isArray(r.data)? r.data : Object.keys(r.data).map(k=>({ id:k, ...r.data[k] })); } } catch(_){} return []; })();
            const map = new Map();
            for (const emp of (Array.isArray(local)? local : [])) { if (emp && emp.id) map.set(String(emp.id), emp); }
            for (const emp of (Array.isArray(remote)? remote : [])) { if (emp && emp.id && !map.has(String(emp.id))) map.set(String(emp.id), emp); }
            const all = Array.from(map.values());
            const candidates = [];
            for (const emp of all) {
                if (isLikelySample(emp)) {
                    const keep = await hasRealReferences(emp.id);
                    if (!keep) candidates.push(emp);
                }
            }
            console.log(`🔎 Funcionários de amostra previstos: ${candidates.length}`);
            return candidates;
        } catch (e) { console.error('❌ Falha ao prever funcionários de amostra:', e); return []; }
    }

    async purgeSampleEmployeesConfirmed(ids) {
        try {
            const set = new Set((ids||[]).map(String));
            const local = JSON.parse(this.readLocalStorageValue('funcionarios_folha')||'[]');
            const keep = (Array.isArray(local)? local : []).filter(emp => !set.has(String(emp.id)));
            this.writeLocalStorageValue('funcionarios_folha', JSON.stringify(keep));
            if (window.firebaseService && typeof window.firebaseService.updatePaths === 'function') {
                const updates = {}; ids.forEach(id => { updates[`funcionarios/${String(id)}`] = null; });
                if (Object.keys(updates).length > 0) await window.firebaseService.updatePaths(updates);
            }
            console.log(`🧹 Funcionários de amostra removidos: ${set.size}`);
            return true;
        } catch (e) { console.error('❌ Falha ao remover funcionários de amostra:', e); return false; }
    }
}

// 🌐 INSTÂNCIA GLOBAL
window.sampleDataGenerator = new SampleDataGenerator();

// 📤 FUNÇÕES DE CONVENIÊNCIA
window.generateSampleData = () => window.sampleDataGenerator.generateAndSaveAll();
window.generateEmployees = () => window.sampleDataGenerator.saveSampleCoreToLocalStorage();
window.generateSampleCore = () => window.sampleDataGenerator.generateAndSaveCore();
window.purgeAllSamplesFinance = () => window.sampleDataGenerator.purgeFinanceSamples();

console.log('🧪 Sample Data Generator carregado - Use generateSampleData() para gerar dados!');
