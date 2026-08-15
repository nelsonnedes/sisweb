/**
 * ✅ CORREÇÃO: Funções globais ausentes (safety net)
 * 
 * Garante que funções críticas estejam disponíveis no window mesmo
 * quando o módulo responsável ainda não carregou, evitando ReferenceError.
 */

console.log('✅ correcao-funcoes-ausentes.js carregado');

window.correcaoFuncoesAusentes = { loaded: true, version: '2.0.0' };

// ─── openClientListModal ───────────────────────────────────────────────────
// Registra um fallback APENAS se nenhuma implementação real já existe.
(function registrarOpenClientListModal() {
    // Se já existe uma implementação real (não fallback), não sobrescreve.
    if (typeof window.openClientListModal === 'function' && !window.openClientListModal._isFallback) {
        return;
    }

    window.openClientListModal = function openClientListModal(event) {
        // Prioridade 1: ModalClientesPCT (romaneiopct.html)
        if (window.ModalClientesPCT && typeof window.ModalClientesPCT.openModal === 'function') {
            return window.ModalClientesPCT.openModal(event);
        }
        // Prioridade 2: ModalClientes (romaneiotl.html e outros)
        if (window.ModalClientes && typeof window.ModalClientes.openModal === 'function') {
            return window.ModalClientes.openModal(event);
        }
        // Prioridade 3: openFornecedorListModal (romaneiotora.html)
        if (typeof window.openFornecedorListModal === 'function') {
            return window.openFornecedorListModal(event);
        }
        // Último recurso: modal nativo pelo ID
        const m = document.getElementById('clientListModal') || document.getElementById('fornecedorListModal');
        if (m) { m.style.display = 'flex'; return; }
        console.warn('⚠️ openClientListModal: nenhuma implementação encontrada no momento da chamada');
    };
    window.openClientListModal._isFallback = true;
    console.log('✅ openClientListModal: fallback canônico registrado por correcao-funcoes-ausentes.js');

    // Re-checar após 500ms: se uma implementação real foi carregada entre meio tempo, usá-la.
    setTimeout(function() {
        const real = window._realOpenClientListModal;
        if (typeof real === 'function' && real !== window.openClientListModal) {
            window.openClientListModal = real;
            console.log('✅ openClientListModal: substituído pela implementação real');
        }
    }, 500);
})();

// ─── openNewClientModal ───────────────────────────────────────────────────
if (typeof window.openNewClientModal !== 'function') {
    window.openNewClientModal = function(event) {
        if (window.ModalClientes && typeof window.ModalClientes.openNewModal === 'function') {
            return window.ModalClientes.openNewModal(event);
        }
        const m = document.getElementById('clientModal') || document.getElementById('clientFormModal');
        if (m) { m.style.display = 'flex'; return; }
        console.warn('⚠️ openNewClientModal: nenhuma implementação encontrada');
    };
}
