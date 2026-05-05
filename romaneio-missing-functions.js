/**
 * 🔧 Funções Faltantes - Romaneio de Toras
 * Este arquivo contém funções que estão sendo chamadas mas não foram definidas
 */

/**
 * Fecha todos os dropdowns da lista
 * Função chamada em romaneiotora_modais.js mas não estava definida
 */
function fecharTodosDropdownsLista() {
    try {
        // Fechar todos os dropdowns abertos na lista
        const dropdowns = document.querySelectorAll('.dropdown-menu.show, .dropdown.show, [data-dropdown-open="true"]');
        
        dropdowns.forEach(dropdown => {
            // Remover classes de ativo
            dropdown.classList.remove('show', 'active');
            dropdown.removeAttribute('data-dropdown-open');
            
            // Se tiver atributo style de display, remover
            if (dropdown.style.display === 'block') {
                dropdown.style.display = 'none';
            }
        });
        
        // Fechar dropdowns específicos do sistema
        const dropdownToggles = document.querySelectorAll('[data-bs-toggle="dropdown"], [data-toggle="dropdown"]');
        dropdownToggles.forEach(toggle => {
            if (toggle.classList.contains('show')) {
                toggle.classList.remove('show');
                toggle.setAttribute('aria-expanded', 'false');
            }
        });
        
        // Log da ação
        if (window.console && window.console.log) {
            console.log('🔽 Todos os dropdowns da lista foram fechados');
        }
        
    } catch (error) {
        // Se houver erro, apenas log silencioso para não quebrar a aplicação
        if (window.console && window.console.warn) {
            console.warn('⚠️ Erro ao fechar dropdowns:', error.message);
        }
    }
}

/**
 * Função auxiliar para fechar dropdown específico
 * @param {string} dropdownId - ID do dropdown a ser fechado
 */
function fecharDropdownEspecifico(dropdownId) {
    try {
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) {
            dropdown.classList.remove('show', 'active');
            dropdown.style.display = 'none';
            dropdown.removeAttribute('data-dropdown-open');
        }
    } catch (error) {
        console.warn('⚠️ Erro ao fechar dropdown específico:', error.message);
    }
}

/**
 * Função para verificar se há dropdowns abertos
 * @returns {boolean} - true se há dropdowns abertos
 */
function temDropdownsAbertos() {
    try {
        const dropdowns = document.querySelectorAll('.dropdown-menu.show, .dropdown.show, [data-dropdown-open="true"]');
        return dropdowns.length > 0;
    } catch (error) {
        console.warn('⚠️ Erro ao verificar dropdowns abertos:', error.message);
        return false;
    }
}

/**
 * Event listener para fechar dropdowns quando clicar fora
 */
document.addEventListener('click', function(event) {
    try {
        // Verificar se o clique foi fora de qualquer dropdown
        const isDropdownClick = event.target.closest('.dropdown, .dropdown-menu, [data-bs-toggle="dropdown"], [data-toggle="dropdown"]');
        
        if (!isDropdownClick && temDropdownsAbertos()) {
            fecharTodosDropdownsLista();
        }
    } catch (error) {
        // Silencioso para não quebrar a aplicação
    }
});

/**
 * Event listener para fechar dropdowns com ESC
 */
document.addEventListener('keydown', function(event) {
    try {
        if (event.key === 'Escape' && temDropdownsAbertos()) {
            fecharTodosDropdownsLista();
        }
    } catch (error) {
        // Silencioso para não quebrar a aplicação
    }
});

// Tornar a função global para compatibilidade
if (typeof window !== 'undefined') {
    window.fecharTodosDropdownsLista = fecharTodosDropdownsLista;
    window.fecharDropdownEspecifico = fecharDropdownEspecifico;
    window.temDropdownsAbertos = temDropdownsAbertos;
}

console.log('✅ Funções faltantes do Romaneio carregadas com sucesso!'); 