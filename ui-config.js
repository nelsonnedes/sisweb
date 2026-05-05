;(function () {
  const root = (typeof window !== 'undefined') ? window : globalThis;
  const current = (root.SiswebUiConfig && typeof root.SiswebUiConfig === 'object') ? root.SiswebUiConfig : {};
  root.SiswebUiConfig = Object.assign({}, current, {
    DEBOUNCE_DIAS_MS: 180
  });
})();
