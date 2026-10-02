/* modules/core/legacy-deprecation.js
 * Fase A4 (warn): armadilha de observação sobre os globais legados
 * `window.getData` / `window.saveData`, disputados por ~20 módulos
 * (último <script> carregado vencia, com semânticas incompatíveis).
 *
 * - NÃO altera comportamento: leitura devolve a implementação vigente,
 *   escrita troca a implementação vigente. Apenas observa + avisa.
 * - console.warn throttled: 1x por local chamador, teto global de 25.
 * - Opt-out: window.SISWEB_LEGACY_SILENT === true pula a instalação
 *   (usado por testes / automação).
 * - Idempotente: dupla inclusão não reinstala.
 * - Estatística: window.__siswebLegacy.stats() ->
 *   { reads, overwrites, locations: { "<local>": n } }
 */
(function () {
    'use strict';

    var global = typeof window !== 'undefined' ? window : Function('return this')();
    if (!global) return;
    if (global.__siswebLegacyTrapInstalled) return;

    var MIGRATE = {
        getData: 'SiswebData.get(key) — ver modules/core/sisweb-data.js',
        saveData: 'SiswebData.save(path, key, data)'
    };
    var MAX_WARNS = 25;

    var stats = { reads: 0, overwrites: 0, locations: {} };
    var warnedLocations = {};
    var warnCount = 0;

    function callerLocation() {
        try {
            var stack = String((new Error()).stack || '').split('\n');
            for (var i = 0; i < stack.length; i++) {
                var line = String(stack[i] || '').trim();
                if (!line) continue;
                if (line.indexOf('legacy-deprecation') !== -1) continue;
                if (/^\bat\b/.test(line) || line.indexOf('http') !== -1 || /\.js:/.test(line)) {
                    return line.slice(0, 180);
                }
            }
        } catch (_) {}
        return '<desconhecido>';
    }

    function warn(kind, name) {
        try {
            if (global.SISWEB_LEGACY_SILENT === true) return;
            var loc = callerLocation();
            var key = kind + '|' + name + '|' + loc;
            stats.locations[loc] = (stats.locations[loc] || 0) + 1;
            if (warnedLocations[key]) return;
            if (warnCount >= MAX_WARNS) return;
            warnedLocations[key] = true;
            warnCount++;
            if (global.console && typeof global.console.warn === 'function') {
                global.console.warn(
                    '[Sisweb][deprecated] window.' + name + ' (' + kind + ') — migre para ' +
                    MIGRATE[name] + ' :: ' + loc
                );
            }
        } catch (_) {}
    }

    function install(name) {
        var current = global[name];
        try {
            Object.defineProperty(global, name, {
                configurable: true,
                enumerable: true,
                get: function () {
                    stats.reads++;
                    warn('leitura', name);
                    return current;
                },
                set: function (v) {
                    stats.overwrites++;
                    warn('sobrescrita', name);
                    current = v;
                }
            });
            return true;
        } catch (_) {
            return false;
        }
    }

    var silent = global.SISWEB_LEGACY_SILENT === true;
    if (!silent) {
        install('getData');
        install('saveData');
    }

    global.__siswebLegacyTrapInstalled = true;
    global.__siswebLegacy = {
        stats: function () {
            return {
                reads: stats.reads,
                overwrites: stats.overwrites,
                locations: Object.assign({}, stats.locations)
            };
        },
        reset: function () {
            stats.reads = 0;
            stats.overwrites = 0;
            stats.locations = {};
            warnedLocations = {};
            warnCount = 0;
        }
    };
})();
