// Expõe parsers centralizados globalmente
// Deve ser carregado como <script type="module">

import { parseBrazilianNumber } from '../utils/formatters.js';

(() => {
  try {
    window.parsers = window.parsers || {};
    if (typeof window.parsers.brazilianNumber !== 'function') {
      window.parsers.brazilianNumber = parseBrazilianNumber;
      console.log('✅ window.parsers.brazilianNumber exposto globalmente');
    } else {
      console.log('ℹ️ window.parsers.brazilianNumber já está definido');
    }
  } catch (err) {
    console.error('❌ Falha ao expor parsers globalmente:', err);
  }
})();