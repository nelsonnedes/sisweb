/**
 * 🛡️ MÓDULO: Validações Específicas PCT
 * 
 * RESPONSABILIDADES:
 * - Validações de campos específicos PCT
 * - Verificação de integridade de dados
 * - Validações de negócio específicas
 * - Testes automáticos
 */

// ============================================================================
// VALIDAÇÕES PRINCIPAIS
// ============================================================================

// ✅ CONVERSÃO: Função global (removido export)
function validarSistemaPCT() {
    const validacoes = [];
    
    // Validar campo pecasPorPacote existe
    const campoPPP = document.getElementById('pecasPorPacote');
    validacoes.push({
        nome: 'campo_pecasPorPacote',
        valido: !!campoPPP,
        detalhes: campoPPP ? 'Campo encontrado' : 'Campo NÃO encontrado'
    });
    
    // Validar funções PCT disponíveis
    const funcoes = ['calcularVolumePCT', 'adicionarItemPCT', 'imprimirRomaneio'];
    funcoes.forEach(funcao => {
        validacoes.push({
            nome: `funcao_${funcao}`,
            valido: typeof window[funcao] === 'function',
            detalhes: typeof window[funcao] === 'function' ? 'Função disponível' : 'Função NÃO encontrada'
        });
    });
    
    return validacoes;
}

// ✅ CONVERSÃO: Função global (removido export)
function testarFuncionalidadesPCT() {
    console.log('🧪 Testando funcionalidades específicas PCT...');
    
    const testes = [];
    
    // Teste 1: Campo pecasPorPacote
    try {
        const campo = document.getElementById('pecasPorPacote');
        if (campo) {
            campo.value = '5';
            const evento = new Event('input', { bubbles: true });
            campo.dispatchEvent(evento);
            testes.push({ nome: 'campo_pecasPorPacote', resultado: 'PASSOU' });
        } else {
            testes.push({ nome: 'campo_pecasPorPacote', resultado: 'FALHOU - Campo não encontrado' });
        }
    } catch (error) {
        testes.push({ nome: 'campo_pecasPorPacote', resultado: `ERRO - ${error.message}` });
    }
    
    // Teste 2: Cálculo com pacotes
    try {
        if (typeof window.calcularVolumePCT === 'function') {
            const volume = window.calcularVolumePCT(2.5, 0.20, 0.03, 10, 5);
            const esperado = ((2.5 * 0.20 * 0.03) / 1000000) * 10 * 5;
            
            if (Math.abs(volume - esperado) < 0.0001) {
                testes.push({ nome: 'calculo_volume_pct', resultado: 'PASSOU' });
            } else {
                testes.push({ nome: 'calculo_volume_pct', resultado: `FALHOU - Esperado: ${esperado}, Obtido: ${volume}` });
            }
        } else {
            testes.push({ nome: 'calculo_volume_pct', resultado: 'FALHOU - Função não encontrada' });
        }
    } catch (error) {
        testes.push({ nome: 'calculo_volume_pct', resultado: `ERRO - ${error.message}` });
    }
    
    return testes;
}

// ============================================================================
// COMPATIBILIDADE GLOBAL
// ============================================================================

// ✅ EXPOSIÇÃO GLOBAL
window.validarSistemaPCT = validarSistemaPCT;
window.testarFuncionalidadesPCT = testarFuncionalidadesPCT;

console.log('✅ Módulo validacoes-pct.js carregado e funções expostas globalmente');
