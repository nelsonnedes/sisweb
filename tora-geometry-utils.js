(function() {
    if (window.ToraGeometry) return;

    function toNumber(value) {
        if (value === null || value === undefined || value === '') return 0;
        if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
        const raw = String(value).replace(/[Rr]\$/g, '').trim();
        if (!raw) return 0;
        let normalized = raw;
        const comma = normalized.lastIndexOf(',');
        const dot = normalized.lastIndexOf('.');
        if (comma > -1 && dot > -1) {
            normalized = comma > dot
                ? normalized.replace(/\./g, '').replace(',', '.')
                : normalized.replace(/,/g, '');
        } else if (comma > -1) {
            normalized = normalized.replace(',', '.');
        }
        normalized = normalized.replace(/[^0-9.\-]/g, '');
        const n = parseFloat(normalized);
        return Number.isFinite(n) ? n : 0;
    }

    function pick(item, keys) {
        for (const key of keys) {
            if (item && item[key] !== undefined && item[key] !== null && item[key] !== '') {
                return item[key];
            }
        }
        return '';
    }

    function calcularVolumeGeoSmalian(compGeo, x1, x2, x3, x4) {
        const l = toNumber(compGeo) / 100;
        const dBase = ((toNumber(x1) + toNumber(x2)) / 2) / 100;
        const dTopo = ((toNumber(x3) + toNumber(x4)) / 2) / 100;
        if (l <= 0 || dBase <= 0 || dTopo <= 0) return 0;
        const areaBase = Math.PI * Math.pow(dBase, 2) / 4;
        const areaTopo = Math.PI * Math.pow(dTopo, 2) / 4;
        return ((areaBase + areaTopo) / 2) * l;
    }

    function normalizarCamposGeoItem(item) {
        const source = item || {};
        const custodia = String(pick(source, ['custodia', 'custody', 'Custodia', 'Custódia']) || '').trim();
        const autef = String(pick(source, ['autef', 'AUTEF', 'Autef', 'documentoFlorestal', 'docFlorestal']) || '').trim();
        const compGeo = toNumber(pick(source, ['compGeo', 'comprimentoGeo', 'comprimentoGeometrico', 'compGeometrico', 'Comp. Geo.', 'Comp Geo']));
        const x1 = toNumber(pick(source, ['x1', 'X1']));
        const x2 = toNumber(pick(source, ['x2', 'X2']));
        const x3 = toNumber(pick(source, ['x3', 'X3']));
        const x4 = toNumber(pick(source, ['x4', 'X4']));
        let volumeGeo = toNumber(pick(source, ['volumeGeo', 'vGeo', 'volumeGeometrico', 'V. Geo.', 'V Geo']));
        if (!volumeGeo) {
            volumeGeo = calcularVolumeGeoSmalian(compGeo, x1, x2, x3, x4);
        }
        return { custodia, autef, compGeo, x1, x2, x3, x4, volumeGeo };
    }

    function formatarMedidaCm(value) {
        const n = toNumber(value);
        if (!n) return '-';
        return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }

    function formatarVolumeGeo(value) {
        const n = toNumber(value);
        if (!n) return '-';
        return n.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    }

    function updateVolumeFromInputs(ids) {
        const map = ids || {};
        const input = (id) => document.getElementById(id);
        const compGeo = input(map.compGeo)?.value;
        const x1 = input(map.x1)?.value;
        const x2 = input(map.x2)?.value;
        const x3 = input(map.x3)?.value;
        const x4 = input(map.x4)?.value;
        const volume = calcularVolumeGeoSmalian(compGeo, x1, x2, x3, x4);
        const out = input(map.volumeGeo);
        if (out) out.value = volume ? volume.toFixed(3) : '0.000';
        return volume;
    }

    function bindVolumeInputs(ids) {
        const keys = ['compGeo', 'x1', 'x2', 'x3', 'x4'];
        keys.forEach((key) => {
            const el = document.getElementById(ids && ids[key]);
            if (el && !el.dataset.geoVolumeBound) {
                el.addEventListener('input', () => updateVolumeFromInputs(ids));
                el.dataset.geoVolumeBound = '1';
            }
        });
        updateVolumeFromInputs(ids);
    }

    window.ToraGeometry = {
        toNumber,
        calcularVolumeGeoSmalian,
        normalizarCamposGeoItem,
        formatarMedidaCm,
        formatarVolumeGeo,
        updateVolumeFromInputs,
        bindVolumeInputs
    };

    if (typeof window.calcularVolumeGeometricoSmalian !== 'function') {
        window.calcularVolumeGeometricoSmalian = calcularVolumeGeoSmalian;
    }
})();
