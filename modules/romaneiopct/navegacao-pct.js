/**
 * 🧭 MÓDULO: Navegação Enter PCT
 * 
 * FUNCIONALIDADES ESPECÍFICAS:
 * - Sequência de navegação incluindo pecasPorPacote
 * - Validação automática durante navegação
 * - Adição automática no último campo
 * - Comportamento específico PCT
 * 
 * SEQUÊNCIA PCT: espessura → largura → price → comprimento → quantidade → pecasPorPacote → ADD
 */

// ✅ CONVERSÃO: Removido import ES6 - usando funções globais

// ============================================================================
// CONFIGURAÇÃO DA NAVEGAÇÃO PCT
// ============================================================================

const SEQUENCIA_CAMPOS_PCT = [
    'espessura',
    'largura', 
    'price',
    'comprimento',
    'quantidade',
    'pecasPorPacote'  // ⚠️ ESPECÍFICO PCT - ÚLTIMO ANTES DE ADICIONAR
];

// ============================================================================
// FUNÇÃO PRINCIPAL: SETUP NAVEGAÇÃO ENTER PCT
// ============================================================================

// ✅ CONVERSÃO: Função global (removido export)
function setupNavegacaoEnterPCT() {
    console.log('🧭 Configurando navegação Enter específica PCT...');
    
    SEQUENCIA_CAMPOS_PCT.forEach((fieldId, index) => {
        const field = document.getElementById(fieldId);
        
        if (field) {
            // Remover listeners anteriores
            field.removeEventListener('keydown', handleEnterNavigation);
            
            // Adicionar novo listener
            field.addEventListener('keydown', function(event) {
                // ✅ CRÍTICO: Prioridade máxima para navegação Enter
                if (event.key === 'Enter') {
                    // Preservar valor atual antes da navegação
                    const valorAtual = event.target.value;
                    
                    // Executar navegação
                    handleEnterNavigation(event, fieldId, index);
                    
                    // ✅ CORREÇÃO ESPECÍFICA: Restaurar valor se foi apagado
                    setTimeout(() => {
                        if (event.target.value === '' && valorAtual !== '') {
                            event.target.value = valorAtual;
                            console.log(`🔧 Valor restaurado em ${fieldId}: ${valorAtual}`);
                        }
                    }, 10);
                } else {
                    handleEnterNavigation(event, fieldId, index);
                }
            });
            
            // Validação específica para pecasPorPacote
            if (fieldId === 'pecasPorPacote') {
                field.addEventListener('input', function(event) {
                    validarCampoPecasPorPacote(event.target);
                });
            }
            
            console.log(`✅ Campo ${fieldId} configurado para navegação PCT`);
        } else {
            console.warn(`⚠️ Campo ${fieldId} não encontrado`);
        }
    });
    
    console.log('✅ Navegação Enter PCT configurada com sucesso');
}

// ============================================================================
// HANDLER DE NAVEGAÇÃO
// ============================================================================

function handleEnterNavigation(event, currentFieldId, currentIndex) {
    if (event.key === 'Enter') {
        event.preventDefault();
        
        // Se é o último campo (pecasPorPacote), adicionar item
        if (currentFieldId === 'pecasPorPacote') {
            console.log('🚀 Último campo atingido - adicionando item PCT');
            
            // Validar campo antes de adicionar
            const campo = event.target;
            if (!validarCampoPecasPorPacote(campo)) {
                return; // Não adicionar se inválido
            }
            
            // Adicionar item
                            // Usar função global do sistema
                if (typeof window.adicionarItem === 'function') {
                    window.adicionarItem();
                } else if (typeof adicionarItem === 'function') {
                    adicionarItem();
                } else {
                    console.warn('Função adicionarItem não encontrada');
                }
            
            // Volcar foco para primeiro campo
            const primeiroCampo = document.getElementById(SEQUENCIA_CAMPOS_PCT[0]);
            if (primeiroCampo) {
                primeiroCampo.focus();
            }
            
        } else {
            // Ir para próximo campo na sequência
            const nextIndex = currentIndex + 1;
            if (nextIndex < SEQUENCIA_CAMPOS_PCT.length) {
                const nextFieldId = SEQUENCIA_CAMPOS_PCT[nextIndex];
                const nextField = document.getElementById(nextFieldId);
                
                if (nextField) {
                    nextField.focus();
                    
                    // ✅ CORREÇÃO CRÍTICA: Selecionar conteúdo no campo "pecasPorPacote"
                    if (nextFieldId === 'pecasPorPacote') {
                        // Aguardar um momento para garantir que o foco foi aplicado
                        setTimeout(() => {
                            // Selecionar todo o conteúdo para facilitar edição
                            nextField.select();
                            console.log(`🎯 Campo ${nextFieldId} focado com conteúdo selecionado`);
                        }, 10);
                    }
                    
                    console.log(`➡️ Navegação: ${currentFieldId} → ${nextFieldId}`);
                } else {
                    console.warn(`⚠️ Próximo campo não encontrado: ${nextFieldId}`);
                }
            }
        }
    }
}

// ============================================================================
// VALIDAÇÃO ESPECÍFICA PECASPORPACOTE
// ============================================================================

function validarCampoPecasPorPacote(campo) {
    const valor = campo.value;
    const validacao = validarPecasPorPacote(valor);
    
    // Remover classes anteriores
    campo.classList.remove('campo-invalido', 'campo-valido');
    
    if (!validacao.valido) {
        campo.classList.add('campo-invalido');
        
        // Mostrar erro temporariamente
        mostrarErroTemporario(campo, validacao.erro);
        
        // Corrigir valor se necessário
        if (validacao.valorCorrigido) {
            campo.value = validacao.valorCorrigido;
        }
        
        return false;
    } else {
        campo.classList.add('campo-valido');
        return true;
    }
}

function mostrarErroTemporario(campo, mensagem) {
    // Criar tooltip de erro
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip-erro-pct';
    tooltip.textContent = mensagem;
    tooltip.style.cssText = `
        position: absolute;
        background: #e74c3c;
        color: white;
        padding: 5px 10px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 1000;
        pointer-events: none;
    `;
    
    // Posicionar próximo ao campo
    const rect = campo.getBoundingClientRect();
    tooltip.style.top = (rect.bottom + 5) + 'px';
    tooltip.style.left = rect.left + 'px';
    
    document.body.appendChild(tooltip);
    
    // Remover após 3 segundos
    setTimeout(() => {
        if (tooltip.parentNode) {
            tooltip.parentNode.removeChild(tooltip);
        }
    }, 3000);
}

// ============================================================================
// COMPATIBILIDADE GLOBAL
// ============================================================================

// ✅ EXPOSIÇÃO GLOBAL
window.setupNavegacaoEnterPCT = setupNavegacaoEnterPCT;

console.log('✅ Módulo navegacao-pct.js carregado e função exposta globalmente');
// Remover definição direta para evitar conflitos
