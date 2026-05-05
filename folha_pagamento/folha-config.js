/**
 * ⚙️ FOLHA CONFIG - CONFIGURAÇÕES DO SISTEMA
 */

// ✅ CONFIGURAÇÕES CLT
const CLT_CONFIG = {
    HORAS_MENSAIS: 220,
    DIAS_MENSAIS: 30,
    SALARIO_MINIMO: 1412.00,
    
    INSS_ALIQUOTAS: [
        { min: 0, max: 1412.00, aliquota: 7.5 },
        { min: 1412.01, max: 2666.68, aliquota: 9.0 },
        { min: 2666.69, max: 4000.03, aliquota: 12.0 },
        { min: 4000.04, max: 7786.02, aliquota: 14.0 }
    ],
    
    IRRF_ALIQUOTAS: [
        { min: 0, max: 2112.00, aliquota: 0, deducao: 0 },
        { min: 2112.01, max: 2826.65, aliquota: 7.5, deducao: 158.40 },
        { min: 2826.66, max: 3751.05, aliquota: 15.0, deducao: 370.40 },
        { min: 3751.06, max: 4664.68, aliquota: 22.5, deducao: 651.73 },
        { min: 4664.69, max: Infinity, aliquota: 27.5, deducao: 884.96 }
    ]
};

// ✅ CONFIGURAÇÕES DE FUNCIONÁRIOS
const FUNCIONARIOS_CONFIG = {
    COLLECTION: 'funcionarios',
    REQUIRED_FIELDS: ['nome', 'cpf', 'cargo', 'salarioBase', 'dataAdmissional'],
    TIPOS_CONTRATO: ['clt', 'temporario', 'terceirizado', 'estagio']
};

// ✅ CONFIGURAÇÕES DE CARGOS
const CARGOS_CONFIG = {
    COLLECTION: 'cargos',
    REQUIRED_FIELDS: ['nome', 'salarioBase'],
    MAX_PERICULOSIDADE: 30,
    MAX_ADICIONAL_NOTURNO: 20,
    VALIDATION_PATTERNS: {
        NOME: /^[A-Za-zÀ-ÿ\s\-\.]{2,100}$/,
        SALARIO: /^\d+(\.\d{2})?$/,
        PERCENTUAL: /^\d{1,2}(\.\d{2})?$/
    }
};

// ✅ CONFIGURAÇÕES DE FOLHA
const FOLHA_CONFIG = {
    COLLECTION: 'folhas',
    TIPOS_PAGAMENTO: ['quinzena', 'mes'],
    PERCENTUAIS_QUINZENA: [40, 50, 60, 100],
    MAX_HORAS_EXTRAS: 44
};

class FolhaConfig {
    constructor() {
        this.clt = CLT_CONFIG;
        this.funcionarios = FUNCIONARIOS_CONFIG;
        this.cargos = CARGOS_CONFIG;
        this.folha = FOLHA_CONFIG;
        // Políticas e assiduidade (defaults)
        this.POLITICAS = {
            pagarEncargosNaQuinzena: false,
            percentuaisQuinzena: [0.4, 0.5, 0.6, 1.0],
            aplicarAssiduidadeNaQuinzena: false,
            usarCaminhoLegado: false
        };
        this.ASSIDUIDADE_PADRAO = 0.02;
        console.log('⚙️ Folha Config inicializado');

        // Carregar configurações persistidas (não bloqueante)
        this._loadRemoteConfigSafe();

		// [BH] Carregar config do Banco de Horas sem bloquear
		this._loadBHConfigSafe();
    }

    getCLTConfig() {
        return this.clt;
    }

    getFuncionariosConfig() {
        return this.funcionarios;
    }

    getCargosConfig() {
        return this.cargos;
    }

    getFolhaConfig() {
        return this.folha;
    }

    // Percentual de assiduidade: override por funcionário > cargo > default
    getAssiduidadePercentual(funcionario, cargo) {
        const f = Number((funcionario && funcionario.assiduidadePercentual));
        const c = Number((cargo && cargo.assiduidadePercentual));
        if (!Number.isNaN(f) && f > 0) return f;
        if (!Number.isNaN(c) && c > 0) return c;
        return Number(this.ASSIDUIDADE_PADRAO) || 0.02;
    }

    async _loadRemoteConfigSafe() {
        try {
            if (!window.getFirebaseManager) return;
            const manager = window.getFirebaseManager();
            const cfg = await manager.loadData('folha/configuracoes', { useCache: true });
            if (cfg && typeof cfg === 'object') {
                if (cfg.politicas && typeof cfg.politicas === 'object') {
                    this.POLITICAS = {
                        ...this.POLITICAS,
                        ...cfg.politicas
                    };
                }
                if (typeof cfg.assiduidadePadraoPercentual === 'number') {
                    this.ASSIDUIDADE_PADRAO = cfg.assiduidadePadraoPercentual;
                }
                console.log('⚙️ Config remota aplicada:', { POLITICAS: this.POLITICAS, ASSIDUIDADE_PADRAO: this.ASSIDUIDADE_PADRAO });
            }
        } catch (e) {
            console.warn('⚠️ Falha ao carregar config remota, usando defaults:', e.message);
        }
    }

	// [BH] Get config atual do Banco de Horas
	getBHConfig() {
		return window.BHConfig || {};
	}

	// [BH] Carregar config do Banco de Horas do RTDB (safe)
	async _loadBHConfigSafe() {
		try {
			if (window.bhLoadConfig) {
				await window.bhLoadConfig();
				console.log('// [BH] Config BH carregada');
			}
		} catch (e) {
			console.warn('// [BH] Falha ao carregar BHConfig:', e.message);
		}
	}

	// [BH] Salvar config do Banco de Horas
	async saveBHConfig(cfg) {
		try {
			if (window.bhSaveConfig) {
				await window.bhSaveConfig(cfg);
				return true;
			}
			return false;
		} catch (e) {
			console.error('// [BH] Erro ao salvar BHConfig:', e);
			return false;
		}
	}
}

// ✅ INICIALIZAÇÃO AUTOMÁTICA
document.addEventListener('DOMContentLoaded', () => {
    const instance = new FolhaConfig();
    // Expor a instância como FolhaConfig (compat com uso atual)
    window.FolhaConfig = instance;
    window.FolhaConfigInstance = instance;
    console.log('✅ FolhaConfig (instância) inicializado globalmente');
});

// ✅ EXPORTAR CLASSE PARA USO GLOBAL (sem sobrescrever instância)
window.FolhaConfigClass = FolhaConfig;
window.CLT_CONFIG = CLT_CONFIG;
window.FUNCIONARIOS_CONFIG = FUNCIONARIOS_CONFIG;
window.CARGOS_CONFIG = CARGOS_CONFIG;
window.FOLHA_CONFIG = FOLHA_CONFIG;

console.log('⚙️ Módulo FolhaConfig carregado');
