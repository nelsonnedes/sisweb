/**
 * 🧮 FOLHA CÁLCULOS - Módulo de Cálculos Salariais
 * Baseado nas regras CLT e convenção SisWeb
 * Implementa todos os cálculos trabalhistas brasileiros
 */

// Função para obter configurações (aguarda carregamento se necessário)
function getConfig() {
    const fallback = {
        CLT_CONFIG: { HORAS_MENSAIS: 220, DIAS_MENSAIS: 30, VALOR_DEPENDENTE_IRRF: 189.59 },
        INSS_ALIQUOTAS: [],
        IRRF_ALIQUOTAS: [],
        POLITICAS: {}
    };
    const fc = window.FolhaConfig;
    if (!fc) {
        console.warn('⚠️ FolhaConfig não carregado ainda, usando valores padrão');
        return fallback;
    }
    // Normalizar para forma esperada neste módulo
    const clt = (fc.getCLTConfig && fc.getCLTConfig()) || fc.clt || window.CLT_CONFIG || {};
    const inss = clt.INSS_ALIQUOTAS || fc.INSS_ALIQUOTAS || [];
    const irrf = clt.IRRF_ALIQUOTAS || fc.IRRF_ALIQUOTAS || [];
    return {
        CLT_CONFIG: {
            HORAS_MENSAIS: clt.HORAS_MENSAIS || 220,
            DIAS_MENSAIS: clt.DIAS_MENSAIS || 30,
            VALOR_DEPENDENTE_IRRF: clt.SALARIO_MINIMO ? (189.59) : 189.59,
            SALARIO_MINIMO: clt.SALARIO_MINIMO
        },
        INSS_ALIQUOTAS: inss,
        IRRF_ALIQUOTAS: irrf,
        POLITICAS: fc.POLITICAS || {},
        SINDICATO: fc.SINDICATO
    };
}

/**
 * 💰 Calcular horas extras
 * @param {number} horas - Quantidade de horas extras
 * @param {number} percentual - Percentual adicional (padrão 50%)
 * @param {number} salarioHora - Valor da hora normal
 * @returns {number} Valor total das horas extras
 */
function calcularHorasExtras(horas, percentual = 50, salarioHora) {
    if (!horas || horas <= 0 || !salarioHora) return 0;
    const round2 = (v) => Math.round(v * 100) / 100;
    const cfg = getConfig();
    const politicas = cfg.POLITICAS || {};
    const doRoundHoraNormal = politicas.roundHoraNormal2Casas !== false; // padrão: arredondar
    const doRoundHoraExtra = politicas.roundHoraExtra2Casas !== false;   // padrão: arredondar
    const doRoundTotalHE   = politicas.roundTotalHorasExtras2Casas !== false; // padrão: arredondar

    // (B) Hora normal com arredondamento por peculiaridade
    let horaNormal = salarioHora;
    if (doRoundHoraNormal) horaNormal = round2(horaNormal);

    // (C) Valor da hora extra
    let valorHoraExtra = horaNormal * (1 + (percentual / 100));
    if (doRoundHoraExtra) valorHoraExtra = round2(valorHoraExtra);

    // (D) Total horas extras
    let totalHorasExtras = valorHoraExtra * horas;
    if (doRoundTotalHE) totalHorasExtras = round2(totalHorasExtras);

    // Logs discretos (ativados somente quando __folhaLogExtras=true)
    try {
        if (window.__folhaLogExtras) {
            console.log(`🕒 [HE] Base/Hora: R$ ${salarioHora.toFixed(6)} → R$ ${horaNormal.toFixed(2)} | Perc: ${percentual}% | Hora Extra: R$ ${valorHoraExtra.toFixed(2)} | Horas: ${horas} | Total: R$ ${totalHorasExtras.toFixed(2)}`);
        }
    } catch {}

    // Log padrão (resumo)
    console.log(`🕒 Horas Extras: ${horas}h x R$ ${horaNormal.toFixed(2)} x ${percentual}% = R$ ${totalHorasExtras.toFixed(2)}`);

    return totalHorasExtras;
}

/**
 * 📅 Calcular valor da quinzena
 * @param {number} salarioBase - Salário base mensal
 * @param {number} percentual - Percentual da quinzena (40%, 50%, 60%, 100%)
 * @param {number} valorManual - Valor manual (opcional)
 * @returns {number} Valor da quinzena
 */
function calcularQuinzena(salarioBase, percentual = 50, valorManual = null) {
    if (!salarioBase || salarioBase <= 0) return 0;
    
    // Se valor manual foi informado, usar ele
    if (valorManual !== null && valorManual > 0) {
        console.log(`📅 Quinzena Manual: R$ ${valorManual.toFixed(2)}`);
        return valorManual;
    }
    
    // Calcular percentual do salário
    const valorQuinzena = salarioBase * (percentual / 100);
    
    console.log(`📅 Quinzena: ${percentual}% de R$ ${salarioBase.toFixed(2)} = R$ ${valorQuinzena.toFixed(2)}`);
    
    return valorQuinzena;
}

// ========================= NOVOS CÁLCULOS (EXTENSÃO COMPAT) =========================

function calcularAssiduidade(salarioBase, percentual, elegivel = true) {
    if (!elegivel || !percentual || percentual <= 0) return 0;
    return Math.max(0, (salarioBase || 0) * percentual);
}

function calcularValorQuinzena(salarioBase, percentual, valorManual) {
    if (valorManual && valorManual > 0) return valorManual;
    const cfg = (window.FolhaConfig && window.FolhaConfig.POLITICAS) || {};
    const p = typeof percentual === 'number' ? percentual : ((cfg.percentuaisQuinzena && cfg.percentuaisQuinzena[0]) || 0.4);
    return Math.max(0, (salarioBase || 0) * p);
}

function somarExtras(extrasDetalhadas = {}) {
    return Object.values(extrasDetalhadas).reduce((s, e) => s + (Number(e && e.valor) || 0), 0);
}

function calcularSindicato(salarioBase, sindicatoCfg) {
    // Placeholder simples: se houver configuração futura, aplicar aqui
    // Por ora, assume 0 para não quebrar fluxo
    return 0;
}

function calcularResumoQuinzena(ctx) {
    const {
        salarioBase, extrasDetalhadas = {}, adicionalNoturno = 0, bonificacoes = 0,
        politicas = (window.FolhaConfig && window.FolhaConfig.POLITICAS) || {},
        percentual, valorManual, incluirExtras = true, incluirBonificacoes = true,
        assiduidadePercentual
    } = ctx;

    let bruto = calcularValorQuinzena(salarioBase, percentual, valorManual);
    
    if (incluirExtras) bruto += somarExtras(extrasDetalhadas) + (adicionalNoturno || 0);
    if (incluirBonificacoes) bruto += bonificacoes;

    const aplicarAssid = politicas.aplicarAssiduidadeNaQuinzena;
    const assid = aplicarAssid ? calcularAssiduidade(salarioBase, assiduidadePercentual, true) : 0;
    bruto += assid;

    const inssObj = politicas.pagarEncargosNaQuinzena ? calcularINSS(bruto) : { valor: 0 };
    const sindicato = politicas.pagarEncargosNaQuinzena ? calcularSindicato(salarioBase, (window.FolhaConfig && window.FolhaConfig.SINDICATO)) : 0;
    const liquido = bruto - (inssObj.valor || 0) - sindicato;

    return { bruto, inss: inssObj.valor || 0, sindicato, liquido, assiduidade: assid };
}

function calcularFechamentoMes(ctx) {
    const {
        base = 0, extrasDetalhadas = {}, adicionalNoturno = 0, bonificacoes = 0,
        descontos = 0, assiduidadePercentual = 0, totalQuinzenasPagas = 0
    } = ctx;

    const assid = calcularAssiduidade(base, assiduidadePercentual, true);
    const brutoMes = base + somarExtras(extrasDetalhadas) + (adicionalNoturno || 0) + (bonificacoes || 0) + assid;

    const inssObj = calcularINSS(brutoMes);
    const sindicato = calcularSindicato(base, (window.FolhaConfig && window.FolhaConfig.SINDICATO));
    const liquidoAntesAbat = brutoMes - (inssObj.valor || 0) - sindicato - (descontos || 0);
    const saldoFinalLiquido = liquidoAntesAbat - (totalQuinzenasPagas || 0);

    return { brutoMes, inss: inssObj.valor || 0, sindicato, liquidoAntesAbat, saldoFinalLiquido, assiduidade: assid };
}

/**
 * 🏥 Calcular INSS (Progressivo por faixas)
 * @param {number} salarioBruto - Salário bruto para cálculo
 * @returns {object} Objeto com valor do INSS e detalhes do cálculo
 */
function calcularINSS(salarioBruto) {
    if (!salarioBruto || salarioBruto <= 0) {
        return { valor: 0, detalhes: [], baseCalculo: 0, aliquotaEfetiva: 0 };
    }
    
    const config = getConfig();
    const INSS_ALIQUOTAS = config.INSS_ALIQUOTAS;
    let inss = 0;
    let salarioRestante = salarioBruto;
    const detalhes = [];
    
    // Aplicar alíquotas progressivas
    for (const faixa of INSS_ALIQUOTAS) {
        if (salarioRestante <= 0) break;
        
        const baseCalculo = Math.min(salarioRestante, faixa.max - faixa.min + 0.01);
        const valorFaixa = baseCalculo * (faixa.aliquota / 100);
        
        if (baseCalculo > 0) {
            inss += valorFaixa;
            // Evitar undefined em objetos salvos no Firebase
            const faixaLabel = (typeof faixa.faixa !== 'undefined' && faixa.faixa !== null)
                ? String(faixa.faixa)
                : `${faixa.min}-${faixa.max === Infinity ? '∞' : faixa.max}`;
            const descricao = typeof faixa.descricao === 'string' ? faixa.descricao : '';
            detalhes.push({
                faixa: faixaLabel,
                baseCalculo: baseCalculo,
                aliquota: faixa.aliquota || 0,
                valor: valorFaixa,
                descricao: descricao
            });
        }
        
        salarioRestante -= baseCalculo;
    }
    
    // Aplicar teto do INSS
    const tetoINSS = 7786.02 * 0.14; // R$ 1.090,04 em 2024
    const inssLimitado = Math.min(inss, tetoINSS);
    
    const aliquotaEfetiva = salarioBruto > 0 ? (inssLimitado / salarioBruto) * 100 : 0;
    
    if (window.__folhaDebugCalculos) {
        console.log(`🏥 INSS: R$ ${inssLimitado.toFixed(2)} (${aliquotaEfetiva.toFixed(2)}% efetiva)`);
    }
    
    return {
        valor: inssLimitado,
        detalhes: detalhes,
        baseCalculo: salarioBruto,
        aliquotaEfetiva: aliquotaEfetiva,
        tetoAplicado: inss > tetoINSS
    };
}

/**
 * 💸 Calcular IRRF (Imposto de Renda Retido na Fonte)
 * @param {number} salarioBruto - Salário bruto
 * @param {number} inss - Valor do INSS já calculado
 * @param {number} dependentes - Número de dependentes (padrão 0)
 * @param {number} outrasDeducoes - Outras deduções legais (padrão 0)
 * @returns {object} Objeto com valor do IRRF e detalhes
 */
function calcularIRRF(salarioBruto, inss, dependentes = 0, outrasDeducoes = 0) {
    if (!salarioBruto || salarioBruto <= 0) {
        return { valor: 0, baseCalculo: 0, faixaAplicada: null, aliquota: 0 };
    }
    
    const config = getConfig();
    const valorDependente = config.CLT_CONFIG.VALOR_DEPENDENTE_IRRF || 189.59;
    const IRRF_ALIQUOTAS = config.IRRF_ALIQUOTAS;
    
    // Base de cálculo = Salário Bruto - INSS - (Dependentes x R$ 189,59) - Outras Deduções
    const deducaoDependentes = dependentes * valorDependente;
    const baseCalculo = salarioBruto - (inss || 0) - deducaoDependentes - (outrasDeducoes || 0);
    
    // Se base de cálculo for negativa ou zero, não há IRRF
    if (baseCalculo <= 0) {
        return { valor: 0, baseCalculo: 0, faixaAplicada: null, aliquota: 0 };
    }
    
    // Encontrar faixa aplicável
    let faixaAplicada = null;
    let irrf = 0;
    
    for (const faixa of IRRF_ALIQUOTAS) {
        if (baseCalculo >= faixa.min && baseCalculo <= faixa.max) {
            faixaAplicada = faixa;
            irrf = (baseCalculo * faixa.aliquota / 100) - faixa.deducao;
            break;
        }
    }
    
    // IRRF não pode ser negativo
    irrf = Math.max(irrf, 0);
    
    if (window.__folhaDebugCalculos) {
        console.log(`💸 IRRF: Base R$ ${baseCalculo.toFixed(2)} → R$ ${irrf.toFixed(2)} (${(((faixaAplicada && faixaAplicada.aliquota) || 0))}%)`);
    }
    
    return {
        valor: irrf,
        baseCalculo: baseCalculo,
        faixaAplicada: faixaAplicada,
        aliquota: (faixaAplicada && faixaAplicada.aliquota) || 0,
        deducaoDependentes: deducaoDependentes,
        dependentes: dependentes
    };
}

/**
 * 🚫 Calcular desconto por faltas
 * @param {number} salarioBase - Salário base mensal
 * @param {number} diasFaltas - Número de dias de falta
 * @returns {number} Valor do desconto por faltas
 */
function calcularDescontoFaltas(salarioBase, diasFaltas) {
    if (!salarioBase || !diasFaltas || diasFaltas <= 0) return 0;
    
    const config = getConfig();
    const diasMensais = config.CLT_CONFIG.DIAS_MENSAIS || 30;
    const valorDia = salarioBase / diasMensais;
    const descontoFaltas = diasFaltas * valorDia;
    
    if (window.__folhaDebugCalculos) {
        console.log(`🚫 Faltas: ${diasFaltas} dias x R$ ${valorDia.toFixed(2)} = R$ ${descontoFaltas.toFixed(2)}`);
    }
    
    return descontoFaltas;
}

/**
 * ⚡ Calcular adicional de periculosidade
 * @param {number} salarioBase - Salário base mensal
 * @param {number} percentual - Percentual de periculosidade (padrão 30%)
 * @returns {number} Valor do adicional de periculosidade
 */
function calcularPericulosidade(salarioBase, percentual = 30) {
    if (!salarioBase || salarioBase <= 0 || !percentual) return 0;
    
    const valorPericulosidade = salarioBase * (percentual / 100);
    
    console.log(`⚡ Periculosidade: ${percentual}% de R$ ${salarioBase.toFixed(2)} = R$ ${valorPericulosidade.toFixed(2)}`);
    
    return valorPericulosidade;
}

/**
 * 🌙 Calcular adicional noturno
 * @param {number} salarioBase - Salário base mensal
 * @param {number} percentual - Percentual adicional noturno (padrão 20%)
 * @returns {number} Valor do adicional noturno
 */
function calcularAdicionalNoturno(salarioBase, percentual = 20) {
    if (!salarioBase || salarioBase <= 0 || !percentual) return 0;
    
    const valorNoturno = salarioBase * (percentual / 100);
    
    console.log(`🌙 Adicional Noturno: ${percentual}% de R$ ${salarioBase.toFixed(2)} = R$ ${valorNoturno.toFixed(2)}`);
    
    return valorNoturno;
}

/**
 * 🏭 Calcular insalubridade
 * @param {string} grau - Grau de insalubridade ('minima', 'media', 'maxima')
 * @returns {number} Valor da insalubridade baseado no salário mínimo
 */
function calcularInsalubridade(grau = 'minima') {
    const config = getConfig();
    const percentuais = {
        'minima': 10,
        'media': 20,
        'maxima': 40
    };
    
    const percentual = percentuais[grau] || 10;
    const salarioMinimo = 1412.00; // Salário mínimo 2024
    const valorInsalubridade = salarioMinimo * (percentual / 100);
    
    console.log(`🏭 Insalubridade ${grau}: ${percentual}% do SM = R$ ${valorInsalubridade.toFixed(2)}`);
    
    return valorInsalubridade;
}

/**
 * 👶 Calcular Salário-Família (regra simplificada por filho)
 * Observação: Valor e faixa podem ser parametrizados via FolhaConfig futuramente
 * @param {number} quantidadeFilhos
 * @returns {number}
 */
function calcularSalarioFamilia(quantidadeFilhos = 0, baseContribuicao = 0, diasTrabalhados = null) {
    const filhos = Number(quantidadeFilhos) || 0;
    console.log('👶 Calculando Salário Família:', { quantidadeFilhos, filhos, baseContribuicao });
    
    if (filhos <= 0) {
        console.log('👶 Nenhum filho informado, retornando 0');
        return 0;
    }

    // Regras 2025: cota fixa por dependente (R$ 65,00) até remuneração de R$ 1.906,04
    const LIMITE_REMUNERACAO = 1906.04;
    const COTA_POR_DEPENDENTE = 65.00;

    // Elegibilidade por remuneração de contribuição (usar salário base como referência mínima)
    const remuneracao = Number(baseContribuicao) || 0;
    console.log('👶 Verificando elegibilidade:', { remuneracao, LIMITE_REMUNERACAO });
    
    if (remuneracao <= 0) {
        console.log('❌ Salário base inválido ou zero');
        return 0;
    }
    
    if (remuneracao > LIMITE_REMUNERACAO) {
        console.log(`❌ NÃO ELEGÍVEL: Salário R$ ${remuneracao.toFixed(2)} > Limite R$ ${LIMITE_REMUNERACAO.toFixed(2)}`);
        console.log('💡 DICA: Para testar, use funcionário com salário ≤ R$ 1.906,04');
        return 0;
    }
    
    console.log(`✅ ELEGÍVEL: Salário R$ ${remuneracao.toFixed(2)} ≤ Limite R$ ${LIMITE_REMUNERACAO.toFixed(2)}`);

    // Proporcionalidade por dias trabalhados quando informado
    if (Number.isFinite(diasTrabalhados) && diasTrabalhados >= 0) {
        const cfg = getConfig();
        const diasMensais = cfg.CLT_CONFIG.DIAS_MENSAIS || 30;
        const dias = Math.min(diasMensais, Number(diasTrabalhados));
        const valorProporcional = (COTA_POR_DEPENDENTE / diasMensais) * dias * filhos;
        console.log('👶 Salário Família proporcional:', { dias, diasMensais, valorProporcional });
        return valorProporcional;
    }

    const valorTotal = filhos * COTA_POR_DEPENDENTE;
    console.log('👶 Salário Família total:', { filhos, COTA_POR_DEPENDENTE, valorTotal });
    return valorTotal;
}

/**
 * 🧮 CÁLCULO COMPLETO DA FOLHA DE PAGAMENTO
 * @param {object} dados - Dados completos para cálculo
 * @returns {object} Resultado completo dos cálculos
 */
function calcularFolhaCompleta(dados) {
    console.log('🧮 Iniciando cálculo completo da folha...');
    
    // Validar dados obrigatórios
    if (!dados.salarioBase || dados.salarioBase <= 0) {
        throw new Error('Salário base é obrigatório e deve ser maior que zero');
    }
    
    // Extrair dados com valores padrão
    const {
        salarioBase,
        horasExtras = 0,
        percentualExtra = 50,
        bonificacoes = 0,
        periculosidade = 0,
        adicionalNoturno = 0,
        insalubridade = null,
        faltas = 0,
        vales = 0,
        outrosDescontos = 0,
        dependentes = 0,
        tipoFolha = 'mes',
        percentualQuinzena = 50, // CORRIGIDO: 50% por padrão
        quinzenaPercentual = 50, // NOVO: suporte para ambos os nomes
        valorManualQuinzena = null,
        outrasDeducoes = 0,
        quantidadeFilhos = 0,
        // Novos campos opcionais
        diasTrabalhados = null,
        premioAssiduidade = 0,
        descontoRepousoRemunerado = 0,
        descontoINSSManual = 0,
        contribuicaoConfederativa = 0,
        contribuicaoSindical = 0,
        descontoIRPJ = 0,
        emprestimoConsignado = 0,
        tipoContrato = '', // NOVO: Receber tipo de contrato para regras de isenção
        removerCalculosAutomaticos = false // NOVO: Flag para desativar cálculos automáticos
    } = dados;
    
    // CORREÇÃO CRÍTICA: Usar o valor correto do percentual
    const percentualQuinzenaFinal = quinzenaPercentual || percentualQuinzena || 50;

    // Normalizar tipo de contrato
    const tcRaw = String(tipoContrato || (dados.funcionario && dados.funcionario.tipoContrato) || '').toLowerCase();
    const tcNorm = tcRaw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const vinculosSemEncargosAuto = new Set(['temporario', 'terceirizado', 'estagio', 'estagiario', 'pj', 'autonomo']);
    const isIsentoEncargos = vinculosSemEncargosAuto.has(tcNorm) || tcNorm.includes('temporario') || tcNorm.includes('terceirizado') || removerCalculosAutomaticos;
    
    // 1. CÁLCULOS BASE
    const config = getConfig();
    const horasMensais = config.CLT_CONFIG.HORAS_MENSAIS || 220;
    const salarioHora = salarioBase / horasMensais;
    const valorHorasExtras = calcularHorasExtras(horasExtras, percentualExtra, salarioHora);
    const baseAjustadaParaFaltas = Math.max(0, salarioBase - (descontoRepousoRemunerado || 0));
    let descontoFaltas = calcularDescontoFaltas(baseAjustadaParaFaltas, faltas);
    // Se "diasTrabalhados" for informado, derivar faltas a partir dele para o desconto
    if (Number.isFinite(diasTrabalhados) && diasTrabalhados >= 0) {
        try {
            const diasMensais = getConfig().CLT_CONFIG.DIAS_MENSAIS || 30;
            const faltasDerivadas = Math.max(0, diasMensais - Number(diasTrabalhados || 0));
            descontoFaltas = calcularDescontoFaltas(baseAjustadaParaFaltas, faltasDerivadas);
        } catch {}
    }
    
    // 2. ADICIONAIS
    const valorPericulosidade = calcularPericulosidade(salarioBase, periculosidade);
    const valorAdicionalNoturno = calcularAdicionalNoturno(salarioBase, adicionalNoturno);
    const valorInsalubridade = insalubridade ? calcularInsalubridade(insalubridade) : 0;
    // Regras 2025: usar salário base como referência de remuneração e aplicar pró-rata por dias quando houver
    const valorSalarioFamilia = calcularSalarioFamilia(quantidadeFilhos, salarioBase, (dados && dados.diasTrabalhados));
    
    // 3. SALÁRIO BRUTO E QUINZENA
    // Salário Bruto (conceito interno) permanece igual ao salário base.
    const salarioBruto = salarioBase;
    
    // Calcular valor da quinzena separadamente
    let valorQuinzena = 0;
    if (tipoFolha === 'quinzena') {
        if (valorManualQuinzena && valorManualQuinzena > 0) {
            valorQuinzena = valorManualQuinzena;
        } else {
            // Regra do toggle: quando ativado, quinzena considera (Base + Bonificações)
            const usarBruto = Boolean(dados.usarSalarioBrutoParaQuinzena);
            const baseParaQuinzena = usarBruto ? (salarioBase + (bonificacoes || 0)) : salarioBase;
            valorQuinzena = baseParaQuinzena * (percentualQuinzenaFinal / 100);
        }
    }

    
    // 4. TOTAL DE ACRÉSCIMOS (para base de cálculo dos encargos)
    const totalAcrescimos = valorHorasExtras + bonificacoes + valorPericulosidade + 
                           valorAdicionalNoturno + valorInsalubridade + valorSalarioFamilia + (premioAssiduidade || 0);
    
    // 5. DESCONTOS OBRIGATÓRIOS (calculados sobre salário base + acréscimos)
    // Salário-família não compõe a base de contribuição (INSS/IRRF). Excluir do cálculo dos encargos.
    const baseCalculoEncargos = salarioBase + (totalAcrescimos - valorSalarioFamilia);
    const calcularEncargos = (tipoFolha !== 'quinzena' || ((window.FolhaConfig && window.FolhaConfig.POLITICAS && window.FolhaConfig.POLITICAS.pagarEncargosNaQuinzena) === true)) && !isIsentoEncargos;
    const calculoINSS = calcularEncargos
        ? calcularINSS(baseCalculoEncargos)
        : { valor: 0, baseCalculo: baseCalculoEncargos, aliquotaEfetiva: 0, detalhes: [] };
    const calculoIRRF = calcularEncargos
        ? calcularIRRF(baseCalculoEncargos, calculoINSS.valor, dependentes, outrasDeducoes)
        : { valor: 0, baseCalculo: 0, aliquota: 0, deducaoDependentes: 0 };
    
    // 6. TOTAL DE DESCONTOS (incluindo faltas)
    const descontosAdicionais = (descontoRepousoRemunerado || 0) + (descontoINSSManual || 0) +
        (contribuicaoConfederativa || 0) + (contribuicaoSindical || 0) +
        (descontoIRPJ || 0) + (emprestimoConsignado || 0);
    const totalDescontos = calculoINSS.valor + calculoIRRF.valor + vales + outrosDescontos + descontoFaltas + descontosAdicionais;
    
    // 7. SALÁRIO LÍQUIDO (fórmula correta)
    // Salário Líquido = (salario base + Acrescimos - Descontos - quinzena)
    const salarioLiquido = salarioBase + totalAcrescimos - totalDescontos - valorQuinzena;
    
    // 8. RESULTADO COMPLETO
    const resultado = {
        // Dados de entrada
        entrada: {
            salarioBase,
            horasExtras,
            percentualExtra,
            bonificacoes,
            periculosidade,
            adicionalNoturno,
            insalubridade,
            faltas,
            vales,
            outrosDescontos,
            dependentes,
            tipoFolha,
            percentualQuinzena,
            valorManualQuinzena
        },
        
        // Cálculos intermediários
        calculos: {
            salarioHora,
            valorHorasExtras,
            valorPericulosidade,
            valorAdicionalNoturno,
            valorInsalubridade,
            valorSalarioFamilia,
            baseAjustadaParaFaltas,
            descontoFaltas,
            valorQuinzena
        },
        
        // Valores principais
        salarioBase,
        salarioBruto,
        totalAcrescimos,
        totalDescontos,
        salarioLiquido,
        
        // Campos necessários para FolhaUtils (compatibilidade)
        tipoPagamento: tipoFolha,
        tipoFolha: tipoFolha,
        quinzenaPercentual: percentualQuinzenaFinal, // CORRIGIDO: usar valor unificado
        percentualQuinzena: percentualQuinzenaFinal, // CORRIGIDO: usar valor unificado
        quinzenaValorManual: valorManualQuinzena,
        valorManualQuinzena: valorManualQuinzena,
        
        // Detalhes dos descontos obrigatórios
        inss: calculoINSS,
        irrf: calculoIRRF,
        
        // Outros descontos
        vales,
        outrosDescontos,
        
        // Informações adicionais
        detalhes: {
            salarioHora: Number(salarioHora) || 0,
            baseINSS: Number(salarioBruto) || 0,
            baseIRRF: Number(calculoIRRF.baseCalculo) || 0,
            // manter chave existente para compat, mas garantir valor definido
            aliquotaINSSEfetiva: (typeof calculoINSS.aliquotaEfetiva === 'number' ? calculoINSS.aliquotaEfetiva : 0),
            aliquotaIRRF: Number(calculoIRRF.aliquota) || 0,
            dependentes: Number(dependentes) || 0,
            deducaoDependentes: Number(calculoIRRF.deducaoDependentes) || 0
        },
        
        // Timestamp do cálculo
        calculadoEm: new Date().toISOString()
    };
    
    console.log('✅ Cálculo completo finalizado:');
    console.log(`   Salário Bruto: R$ ${salarioBruto.toFixed(2)}`);
    if (window.__folhaDebugCalculos) {
        console.log(`   INSS: R$ ${calculoINSS.valor.toFixed(2)}`);
        console.log(`   IRRF: R$ ${calculoIRRF.valor.toFixed(2)}`);
    }
    console.log(`   Total Descontos: R$ ${totalDescontos.toFixed(2)}`);
    console.log(`   Salário Líquido: R$ ${salarioLiquido.toFixed(2)}`);
    
    return resultado;
}

/**
 * 📊 Validar dados de entrada para cálculo
 * @param {object} dados - Dados para validação
 * @returns {object} Resultado da validação
 */
function validarDadosCalculo(dados) {
    const erros = [];
    const avisos = [];
    
    // Validações obrigatórias
    if (!dados.salarioBase || dados.salarioBase <= 0) {
        erros.push('Salário base é obrigatório e deve ser maior que zero');
    }
    
    const salarioMinimo = 1412.00; // Salário mínimo 2024
    if (dados.salarioBase && dados.salarioBase < salarioMinimo) {
        erros.push(`Salário base não pode ser menor que o salário mínimo (R$ ${salarioMinimo.toFixed(2)})`);
    }
    
    // Validações de limites
    if (dados.horasExtras && dados.horasExtras > 44) {
        avisos.push('Horas extras excedem o limite legal de 44h mensais');
    }
    
    if (dados.percentualExtra && (dados.percentualExtra < 50 || dados.percentualExtra > 200)) {
        avisos.push('Percentual de horas extras fora do padrão (50% a 200%)');
    }
    
    if (dados.faltas && dados.faltas > 30) {
        erros.push('Número de faltas não pode ser maior que 30 dias');
    }
    
    if (dados.dependentes && dados.dependentes > 10) {
        avisos.push('Número de dependentes muito alto (acima de 10)');
    }
    
    if (dados.percentualQuinzena && (dados.percentualQuinzena < 30 || dados.percentualQuinzena > 100)) {
        erros.push('Percentual de quinzena deve estar entre 30% e 100%');
    }
    
    return {
        valido: erros.length === 0,
        erros,
        avisos
    };
}

/**
 * 🔢 Funções auxiliares de cálculo
 */
const CalculosAuxiliares = {
    /**
     * Calcular valor por hora
     */
    calcularValorHora: (salarioBase) => {
        const config = getConfig();
        const horasMensais = config.CLT_CONFIG.HORAS_MENSAIS || 220;
        return salarioBase / horasMensais;
    },
    
    /**
     * Calcular valor por dia
     */
    calcularValorDia: (salarioBase) => {
        const config = getConfig();
        const diasMensais = config.CLT_CONFIG.DIAS_MENSAIS || 30;
        return salarioBase / diasMensais;
    },
    
    /**
     * Calcular teto do INSS
     */
    calcularTetoINSS: () => 7786.02 * 0.14,
    
    /**
     * Verificar se salário está na faixa de isenção do IRRF
     */
    isIsentoIRRF: (baseCalculo) => baseCalculo <= 2112.00,
    
    /**
     * Calcular percentual efetivo de desconto
     */
    calcularPercentualEfetivo: (salarioBruto, totalDescontos) => {
        return salarioBruto > 0 ? (totalDescontos / salarioBruto) * 100 : 0;
    }
};

// ✅ EXPORTAR FUNÇÕES GLOBALMENTE
window.FolhaCalculos = {
    calcularAssiduidade,
    calcularValorQuinzena,
    calcularResumoQuinzena,
    calcularFechamentoMes,
    // Funções principais
    calcularHorasExtras,
    calcularQuinzena,
    calcularINSS,
    calcularIRRF,
    calcularDescontoFaltas,
    calcularPericulosidade,
    calcularAdicionalNoturno,
    calcularInsalubridade,
    calcularSalarioFamilia,
    calcularFolhaCompleta,
    
    // Validações
    validarDadosCalculo,
    
    // Auxiliares
    CalculosAuxiliares
};

console.log('🧮 Folha Cálculos carregado com sucesso');
console.log('📊 Funções disponíveis:', Object.keys(window.FolhaCalculos));
