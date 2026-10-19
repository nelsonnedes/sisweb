/* Unidades de medida - normalização e rótulos visuais.
   O valor fiscal (NF-e uCom) permanece ML; a UI exibe LN para Metro Linear. */
(function (root) {
    'use strict';

    function key(v) {
        return String(v == null ? '' : v).trim().toUpperCase().replace(/\./g, '').replace(/\s+/g, '');
    }
    function isLinear(v) {
        return ['ML', 'LN', 'M', 'MT', 'MTS', 'METRO', 'METROS', 'METROLINEAR', 'METROSLINEARES', 'LINEAR', 'LINEARES'].indexOf(key(v)) >= 0;
    }
    function normalizarCadastro(v) {
        var s = String(v == null ? '' : v).trim();
        if (!s) return 'UN';
        if (isLinear(s)) return 'LN';
        var k = key(s);
        if (['UN', 'UND', 'UNID', 'UNIDADE', 'UNIDADES'].indexOf(k) >= 0) return 'UN';
        if (['DZ', 'DUZIA', 'DUZIAS'].indexOf(k) >= 0) return 'DZ';
        if (['PC', 'PCS', 'PECA', 'PECAS'].indexOf(k) >= 0) return 'PC';
        if (['M3', 'M³', 'M^3', 'METROCUBICO', 'METROSCUBICOS'].indexOf(k) >= 0) return 'm³';
        if (['M2', 'M²', 'M^2', 'METROQUADRADO', 'METROSQUADRADOS'].indexOf(k) >= 0) return 'm²';
        return s;
    }
    function texto(v) {
        if (isLinear(v)) return 'LN';
        var k = key(v);
        if (['UN', 'UND', 'UNID', 'UNIDADE', 'UNIDADES'].indexOf(k) >= 0) return 'UN';
        if (['DZ', 'DUZIA', 'DUZIAS'].indexOf(k) >= 0) return 'DZ';
        if (['PC', 'PCS', 'PECA', 'PECAS'].indexOf(k) >= 0) return 'PC';
        if (['M3', 'M³', 'M^3', 'METROCUBICO'].indexOf(k) >= 0) return 'm³';
        if (['M2', 'M²', 'M^2', 'METROQUADRADO'].indexOf(k) >= 0) return 'm²';
        return String(v == null ? '' : v).trim();
    }
    function nome(v) {
        var t = texto(v);
        if (t === 'LN') return 'LN - Metro Linear';
        if (t === 'UN') return 'UN - Unidade';
        if (t === 'DZ') return 'DZ - Dúzia';
        if (t === 'PC') return 'PC - Peça';
        if (t === 'm³') return 'm³ - Metro Cúbico';
        if (t === 'm²') return 'm² - Metro Quadrado';
        return t;
    }
    function fiscal(v) {
        return isLinear(v) ? 'ML' : String(v == null ? '' : v).trim().toUpperCase();
    }

    root.SiswebUnidades = {
        normalizar: normalizarCadastro,
        texto: texto,
        nome: nome,
        isLinear: isLinear,
        fiscal: fiscal,
    };
})(typeof window !== 'undefined' ? window : globalThis);
