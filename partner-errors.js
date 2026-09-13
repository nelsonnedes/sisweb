/**
 * partner-errors.js — Mensagens PT-BR do Programa de Parceiros (contrato compartilhado).
 *
 * Usado por portal-parceiro.html, cadastro-parceiro.html e subscription.html.
 * Centraliza as cópias para não divergirem entre as 3 páginas.
 *
 * CONTRATO: os textos abaixo são travados por tests/partner-program.test.mjs.
 * Ao alterar qualquer copy, atualize os testes correspondentes.
 *
 * Sem dependências. Expõe `window.PartnerErrors`. Páginas devem chamar com
 * fallback local caso este script falhe ao carregar.
 */
(function () {
    'use strict';

    var MESSAGES = {
        rateLimit: 'Limite de uso atingido. Aguarde alguns instantes e tente novamente.',
        invalidData: 'Dados inválidos. Confira os campos e tente novamente.',
        unavailable: 'Serviço indisponível no momento. Tente novamente em instantes.',
        generic: 'Não foi possível concluir. Tente novamente.',
        invalidCode: 'Código inválido. Verifique e tente novamente.',
        ownCode: 'Este código de parceiro é seu e não pode gerar indicação. Informe o código de outro parceiro ou use um cupom promocional ativo.',
        blockedTitle: 'Acesso bloqueado',
        blockedBody: 'Seu cadastro de parceiro está bloqueado. O dashboard e as conversas permanecem indisponíveis.',
        pendingTitle: 'Cadastro pendente',
        pendingBody: 'Seu cadastro de parceiro está pendente de aprovação. O dashboard permanece indisponível até a ativação.',
        verifyTitle: 'Confirme seu e-mail',
        verifyBody: 'A conta precisa ter o e-mail confirmado antes do claim.',
        claimedTitle: 'Acesso já reivindicado',
        claimedBody: 'Este cadastro de parceiro já está vinculado a outra conta.',
        activateFailTitle: 'Não foi possível ativar',
        activateFailBody: 'Verifique o código e tente novamente. Se o problema continuar, fale com o suporte.'
    };

    function rawText(err) {
        var raw = '';
        if (err && err.code) raw += ' ' + String(err.code);
        if (err && err.message) raw += ' ' + String(err.message);
        if (typeof err === 'string') raw += ' ' + err;
        return raw;
    }

    // Formato string (cadastro-parceiro.html).
    function message(err, fallback) {
        var s = rawText(err).toLowerCase();
        if (/resource-exhausted|quota|limite|too-many|rate/.test(s)) return MESSAGES.rateLimit;
        if (/invalid-argument|validation/.test(s)) return MESSAGES.invalidData;
        if (/internal|unavailable|deadline|network|fetch|cors|timeout|servi[cç]o|5\d\d|offline/.test(s)) return MESSAGES.unavailable;
        return fallback || MESSAGES.generic;
    }

    // Formato {title, body} para estados restritos (portal-parceiro.html).
    function restricted(error) {
        var raw = String(error && ((error.error || error.message) || error) || '').toLowerCase();
        if (/bloquead/.test(raw)) return { title: MESSAGES.blockedTitle, body: MESSAGES.blockedBody };
        if (/pendent/.test(raw)) return { title: MESSAGES.pendingTitle, body: MESSAGES.pendingBody };
        if (/verifi|email/.test(raw)) return { title: MESSAGES.verifyTitle, body: MESSAGES.verifyBody };
        if (/already-exists|outra conta|conflito/.test(raw)) return { title: MESSAGES.claimedTitle, body: MESSAGES.claimedBody };
        return { title: MESSAGES.activateFailTitle, body: MESSAGES.activateFailBody };
    }

    function ownCodeMessage() {
        return MESSAGES.ownCode;
    }

    window.PartnerErrors = {
        MESSAGES: MESSAGES,
        rawText: rawText,
        message: message,
        restricted: restricted,
        ownCodeMessage: ownCodeMessage
    };
})();
