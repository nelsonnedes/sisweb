/* Cálculos canônicos de madeira serrada - espelha vendas.js.
   Compartilhado pela página de estoque para evitar divergência no nó produtos. */
(function (root) {
    'use strict';

    function num(v) {
        return parseFloat(String(v == null ? '' : v).replace(',', '.')) || 0;
    }
    function round(v, d) {
        var f = Math.pow(10, d);
        return Math.round((Number(v) || 0) * f) / f;
    }
    function r3(v) { return round(v, 3); }
    function r2(v) { return round(v, 2); }
    function isNomeFantasma(v) {
        var s = String(v == null ? '' : v).trim().toLowerCase();
        return s === '' || s === 'produto sem nome' || s === 'nome não informado';
    }
    function nomeSignificativo() {
        for (var i = 0; i < arguments.length; i++) {
            var v = arguments[i];
            if (!isNomeFantasma(v)) return String(v || '').trim();
        }
        return '';
    }
    function nomeExibicao(p) {
        if (!p || typeof p !== 'object') return 'Produto sem nome';
        return nomeSignificativo(p.nomeComum, p.nome, p.name, p.nomeCientifico) || 'Produto sem nome';
    }
    function temDimsSerrado(p) {
        if (!p || typeof p !== 'object') return false;
        if (p.tipoProduto === 'romaneio') return true;
        var e = num(p.espessura), l = num(p.largura), c = num(p.comprimento);
        if (e > 0 || l > 0 || c > 0) return true;
        return num(p.volumeM3) > 0 && num(p.pecas) > 0;
    }
    function calcularVolume(e, l, c, qtd, ppp) {
        var q = num(qtd), p = num(ppp) || 1;
        if (!(num(e) > 0 && num(l) > 0 && num(c) > 0 && q > 0)) return 0;
        return r3((num(e) * num(l) * num(c) / 1e6) * q * p);
    }
    function volumeProduto(p) {
        if (!p || typeof p !== 'object') return 0;
        var stored = num(p.volumeM3);
        if (stored > 0) return stored;
        var calc = calcularVolume(p.espessura, p.largura, p.comprimento, p.pecas, p.pecasPorPacote || 1);
        if (calc > 0) return calc;
        var est = num(p.estoque);
        return est > 0 ? est : 0;
    }
    function metrosLineares(p) {
        var salvo = num(p && p.metrosLineares);
        if (salvo > 0) return r2(salvo);
        return r2((num(p && p.comprimento) / 100) * num(p && p.pecas));
    }
    function area(p) {
        return (num(p && p.largura) / 100) * (num(p && p.comprimento) / 100)
            * num(p && p.pecas) * (num(p && p.pecasPorPacote) || 1);
    }
    function dimensoes(p) {
        return {
            pecas: num(p && p.pecas),
            vol: volumeProduto(p),
            ml: metrosLineares(p),
            area: area(p),
        };
    }
    function estoqueZeradoNaLista(p) {
        if (!p || typeof p !== 'object') return false;
        var est = Number(p.estoque != null ? p.estoque : p.quantidade) || 0;
        if (temDimsSerrado(p)) return num(p.pecas) <= 0 && est <= 0;
        return est <= 0;
    }
    function isProdutoJunk(p) {
        if (!p || typeof p !== 'object') return true;
        var temNome = [p.nome, p.name, p.nomeComum, p.nomeCientifico].some(function (v) { return !isNomeFantasma(v); });
        if (temNome) return false;
        var preco = num(p.preco != null ? p.preco : p.price);
        var est = num(p.estoque != null ? p.estoque : p.quantidade);
        return !(preco > 0 || est > 0);
    }
    function formatCurrency(v) {
        return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    function formatNumber(v, d) {
        return (Number(v) || 0).toLocaleString('pt-BR', {
            minimumFractionDigits: d == null ? 3 : d,
            maximumFractionDigits: d == null ? 3 : d,
        });
    }

    root.EstoqueSerradoCore = {
        num: num,
        r2: r2,
        r3: r3,
        isNomeFantasma: isNomeFantasma,
        nomeSignificativo: nomeSignificativo,
        nomeExibicao: nomeExibicao,
        temDimsSerrado: temDimsSerrado,
        calcularVolume: calcularVolume,
        volumeProduto: volumeProduto,
        metrosLineares: metrosLineares,
        area: area,
        dimensoes: dimensoes,
        estoqueZeradoNaLista: estoqueZeradoNaLista,
        isProdutoJunk: isProdutoJunk,
        formatCurrency: formatCurrency,
        formatNumber: formatNumber,
    };
})(typeof window !== 'undefined' ? window : globalThis);
