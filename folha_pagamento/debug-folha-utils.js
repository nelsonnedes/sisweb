/**
 * 🐛 DEBUG FOLHA UTILS - DIAGNÓSTICO DE PROBLEMAS
 * Este arquivo deve ser carregado ANTES de folha-utils.js para diagnosticar problemas
 */

(function() {
var __folhaDebugMode = window.__folhaDebugMode || window.__folhaDebugLevel || (window.__folhaDebug === true ? 'data' : 'none');
var __folhaDebugAll = String(__folhaDebugMode) === 'all';
if (!__folhaDebugAll) return;
console.log('🐛 DEBUG: Iniciando diagnóstico de FolhaUtils...');

// Verificar estado inicial
console.log('🔍 Estado inicial:', {
    'window.FolhaUtils': typeof window.FolhaUtils,
    'window.renderizarTabelaLancamentos': typeof window.renderizarTabelaLancamentos,
    'document.readyState': document.readyState,
    'scripts carregados': Array.from(document.scripts).map(s => s.src.split('/').pop())
});

// ✅ CORREÇÃO: Não interceptar, apenas monitorar quando já existir
// O folha-utils.js usa Object.defineProperty com configurable: false, então não podemos interceptar
// Apenas aguardar e verificar quando ambos existirem

// Monitorar mudanças no DOM
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
                if (node.tagName === 'SCRIPT' && node.src) {
                    console.log('📜 Script carregado:', node.src.split('/').pop());
                }
            });
        }
    });
});

observer.observe(document.head, {
    childList: true,
    subtree: true
});

// ✅ CORREÇÃO: Verificação única após carregamento completo
let verificacaoRealizada = false;
const verificarUmaVez = () => {
    if (verificacaoRealizada) return;
    
    // Verificar se todos os componentes críticos estão carregados
    const folhaUtilsOk = typeof window.FolhaUtils !== 'undefined';
    const renderTabelaOk = typeof window.renderizarTabelaLancamentos !== 'undefined';
    
    if (folhaUtilsOk && renderTabelaOk) {
        console.log('✅ Verificação concluída: Todos os componentes carregados', {
            'FolhaUtils': typeof window.FolhaUtils,
            'renderizarTabelaLancamentos': typeof window.renderizarTabelaLancamentos,
            'folhaSystem': typeof window.folhaSystem,
            'folhaLancamentos': typeof window.folhaLancamentos
        });
        verificacaoRealizada = true;
        observer.disconnect(); // Parar de observar quando tudo estiver carregado
    } else {
        console.log('⏳ Aguardando componentes...', {
            'FolhaUtils': folhaUtilsOk ? '✅' : '⏳',
            'renderizarTabelaLancamentos': renderTabelaOk ? '✅' : '⏳'
        });
    }
};

// Verificar após pequeno delay e novamente após mais tempo
setTimeout(verificarUmaVez, 200);
setTimeout(verificarUmaVez, 1000);
setTimeout(verificarUmaVez, 3000);

console.log('🐛 DEBUG: Diagnóstico configurado');

(function(){
  function assert(name, condition){
    const ok = !!condition;
    console.log(`${ok ? '✅' : '❌'} TESTE: ${name}`);
    return ok;
  }
  async function delay(ms){ return new Promise(r=>setTimeout(r, ms)); }

  async function runPreloadTests(){
    try {
      if (!window.FolhaUtils) {
        console.log('⚠️ FolhaUtils indisponível para testes de preload');
        return;
      }
      // Teste toast: deve estar no bottom e sem top
      try { window.FolhaUtils.showToast('Teste preload', 'info', 800); } catch(e){}
      await delay(50);
      const tc = document.getElementById('toast-container-folha');
      assert('Toast container existe', tc);
      if (tc) {
        const style = window.getComputedStyle(tc);
        assert('Toast sem top ativo', (style.top === 'auto' || style.top === '')); 
        assert('Toast com bottom', parseInt(style.bottom) >= 0);
      }

      // Teste preload tabela
      try { window.FolhaUtils.showTablePreload(5); } catch(e){}
      await delay(50);
      const tblCont = document.querySelector('#tabela-folhas-section .table-container') || document.querySelector('.table-container');
      assert('Table container existe', tblCont);
      if (tblCont) {
        assert('Classe loading aplicada na tabela', tblCont.classList.contains('loading'));
      }
      try { window.FolhaUtils.hideTablePreload(); } catch(e){}
      await delay(50);
      if (tblCont) {
        assert('Classe loading removida da tabela', !tblCont.classList.contains('loading'));
      }

      // Teste preload modal funcionários
      if (window.folhaFuncionarios && typeof window.folhaFuncionarios.openFuncionariosListModal === 'function') {
        window.folhaFuncionarios.openFuncionariosListModal();
        await delay(10);
        const modal = document.getElementById('funcionariosListModal');
        assert('Modal funcionários existe', modal);
        if (modal) {
          assert('Classe loading aplicada no modal', modal.classList.contains('loading'));
        }
        await delay(1200);
        if (modal) {
          assert('Classe loading removida do modal', !modal.classList.contains('loading'));
        }
        // Fechar modal
        try { window.folhaFuncionarios.closeFuncionariosListModal(); } catch(e){}
      } else {
        console.log('⚠️ Módulo folhaFuncionarios indisponível para teste do modal');
      }
      // Teste paginação emitindo evento e escondendo preload
      try {
        const rowsBefore = (document.getElementById('folhasTableBody') || { querySelectorAll: ()=>[] }).querySelectorAll ? document.getElementById('folhasTableBody').querySelectorAll('tr').length : 0;
        let eventCount = 0;
        const handler = (ev) => { eventCount++; };
        window.addEventListener('tabelaFolhasRenderizada', handler);
        const dataset = Array.from({ length: 12 }).map((_, i) => ({
          id: `t_${i+1}`,
          funcionario: { id: `f_${i+1}`, nome: `Funcionario ${i+1}`, ativo: true },
          mesAno: '2025-11',
          tipo: 'mes'
        }));
        if (window.folhaPaginacao && typeof window.folhaPaginacao.aplicarFiltrosComPaginacao === 'function') {
          window.folhaPaginacao.aplicarFiltrosComPaginacao(dataset);
          await delay(200);
          const rowsAfter = (document.getElementById('folhasTableBody') || { querySelectorAll: ()=>[] }).querySelectorAll ? document.getElementById('folhasTableBody').querySelectorAll('tr').length : 0;
          assert('Evento tabelaFolhasRenderizada emitido', eventCount > 0);
          assert('Tabela possui linhas após paginação', rowsAfter >= 1 || rowsAfter !== rowsBefore);
        } else {
          console.log('⚠️ Módulo de paginação indisponível para teste');
        }
        window.removeEventListener('tabelaFolhasRenderizada', handler);
      } catch(e) {
        console.log('⚠️ Erro no teste de paginação:', e && e.message ? e.message : e);
      }
    } catch (e) {
      console.log('❌ Erro nos testes de preload:', e && e.message ? e.message : e);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const qp = String(window.location && window.location.search || '');
    const enabled = (!!window.__RUN_DEBUG_PRELOAD) || qp.includes('debugPreload=1');
    if (enabled) {
      setTimeout(runPreloadTests, 1500);
    }
  });
})();
})();
