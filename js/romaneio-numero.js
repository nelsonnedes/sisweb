/* Numeração oficial de romaneios (business number). Ativar com
   window.SISWEB_ROMANEIO_SEQUENCE = true após migração/backfill.
   Mantém id/chave técnico intacto. */
(function (root) {
    'use strict';

    function pad(value) {
        const n = Number(value) || 0;
        return n > 0 ? String(n).padStart(6, '0') : '';
    }
    function formatar(record) {
        if (!record || typeof record !== 'object') return '';
        const formatted = String(record.numeroFormatado || '').trim();
        if (/^\d{6}$/.test(formatted)) return formatted;
        return pad(record.numeroSequencial || record.numeroExibicao);
    }
    function safeRecordId(value) {
        return String(value == null ? '' : value).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 100);
    }
    function operationId(tipo, recordId) {
        return ('rom-' + tipo + '-' + safeRecordId(recordId)).slice(0, 128);
    }
    async function reservar(tipo, recordId) {
        if (root.SISWEB_ROMANEIO_SEQUENCE !== true) return null;
        const svc = root.firebaseService || root.FirebaseService;
        if (!svc || typeof svc.callFunction !== 'function') {
            throw new Error('Serviço de numeração de romaneios indisponível.');
        }
        const safeId = safeRecordId(recordId);
        if (!safeId) throw new Error('Romaneio sem identificador para reservar número.');
        const result = await svc.callFunction('romaneioReservarNumero', {
            tipo,
            operationId: operationId(tipo, safeId),
            recordId: safeId,
        });
        if (!result || result.success !== true || !result.numeroFormatado) {
            throw new Error((result && result.error) || 'Não foi possível reservar o número do romaneio.');
        }
        return result;
    }
    async function aplicar(tipo, record) {
        if (!record || typeof record !== 'object') return record;
        const current = formatar(record);
        if (current && root.SISWEB_ROMANEIO_SEQUENCE !== true) return record;
        const result = await reservar(tipo, record.id || record.numero);
        if (!result) return record;
        record.numeroSequencial = result.numeroSequencial;
        record.numeroFormatado = result.numeroFormatado;
        record.numeroExibicao = result.numeroSequencial;
        return record;
    }

    function preservar(record, anterior) {
        if (!record || typeof record !== 'object' || !anterior || typeof anterior !== 'object') return record;
        ['numeroSequencial', 'numeroFormatado', 'numeroExibicao', 'legacyId'].forEach(function (key) {
            if (record[key] == null && anterior[key] != null) record[key] = anterior[key];
        });
        return record;
    }

    root.SiswebRomaneioNumero = { formatar, reservar, aplicar, preservar };
})(typeof window !== 'undefined' ? window : globalThis);
