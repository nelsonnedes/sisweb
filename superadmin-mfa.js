/**
 * superadmin-mfa.js — Cliente de MFA (TOTP) para Super Admin.
 *
 * Wrapper das callables `superAdminMfa*` (functions/mfa-functions.js).
 * Usa `firebaseService.callFunction` (padrão canônico do projeto), que trata
 * autenticação/idToken e unwrap do resultado. Sem dependência de framework.
 *
 * API exposta:
 *   window.SuperAdminMfa.status()          → { success, enabled, hasSecret, createdAt }
 *   window.SuperAdminMfa.setup()           → { success, secret, otpauthUri, label, issuer, digits, period }
 *   window.SuperAdminMfa.confirm(code)     → { success, ok }
 *   window.SuperAdminMfa.verify(code)      → { success, ok }
 *   window.SuperAdminMfa.disable()         → { success, ok }
 */
(function () {
    'use strict';

    function callFunction(name, payload) {
        if (window.firebaseService && typeof window.firebaseService.callFunction === 'function') {
            return window.firebaseService.callFunction(name, payload || {});
        }
        return Promise.reject(new Error('firebaseService.callFunction indisponível.'));
    }

    function unwrap(result) {
        // callFunction já retorna o payload desembrulhado; defensivo para { data }.
        if (result && typeof result === 'object' && result.data !== undefined
            && Object.prototype.hasOwnProperty.call(result, 'data')
            && !Object.prototype.hasOwnProperty.call(result, 'success')
            && !Object.prototype.hasOwnProperty.call(result, 'ok')) {
            return result.data;
        }
        return result;
    }

    window.SuperAdminMfa = {
        status: function () {
            return callFunction('superAdminMfaStatus').then(unwrap);
        },
        setup: function () {
            return callFunction('superAdminMfaSetup').then(unwrap);
        },
        confirm: function (code) {
            return callFunction('superAdminMfaConfirm', { code: String(code || '').trim() }).then(unwrap);
        },
        verify: function (code) {
            return callFunction('superAdminMfaVerify', { code: String(code || '').trim() }).then(unwrap);
        },
        disable: function () {
            return callFunction('superAdminMfaDisable').then(unwrap);
        }
    };
})();
