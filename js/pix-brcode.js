/**
 * pix-brcode.js
 * Módulo compartilhado para geração de payload PIX BR Code (EMV).
 * Extraído da lógica consolidada de folha-utils.js.
 */
(function() {
  const PixBrCode = {
    normalizePixKeyType(value) {
      const normalized = String(value || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
      if (normalized === 'cpf') return 'cpf';
      if (normalized === 'cnpj') return 'cnpj';
      if (['telefone', 'phone', 'celular', 'fone'].includes(normalized)) return 'telefone';
      if (['email', 'mail', 'e-mail'].includes(normalized)) return 'email';
      if (['aleatoria', 'aleatorio', 'evp', 'uuid', 'random', 'chavealeatoria'].includes(normalized)) return 'aleatoria';
      return '';
    },

    onlyPixDigits(value) {
      return String(value || '').replace(/\D/g, '');
    },

    isValidCpfDigits(value) {
      const cpf = this.onlyPixDigits(value);
      if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;

      let sum = 0;
      for (let index = 0; index < 9; index += 1) {
        sum += Number(cpf[index]) * (10 - index);
      }
      let firstDigit = (sum * 10) % 11;
      if (firstDigit === 10) firstDigit = 0;
      if (firstDigit !== Number(cpf[9])) return false;

      sum = 0;
      for (let index = 0; index < 10; index += 1) {
        sum += Number(cpf[index]) * (11 - index);
      }
      let secondDigit = (sum * 10) % 11;
      if (secondDigit === 10) secondDigit = 0;
      return secondDigit === Number(cpf[10]);
    },

    isValidCnpjDigits(value) {
      const cnpj = this.onlyPixDigits(value);
      if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;

      const calculateDigit = (base, weights) => {
        const sum = weights.reduce((total, weight, index) => total + (Number(base[index]) * weight), 0);
        const rest = sum % 11;
        return rest < 2 ? 0 : 11 - rest;
      };
      const firstDigit = calculateDigit(cnpj, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
      const secondDigit = calculateDigit(cnpj, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
      return firstDigit === Number(cnpj[12]) && secondDigit === Number(cnpj[13]);
    },

    detectPixKeyType(value) {
      const raw = String(value || '').trim();
      if (!raw) return '';
      const compact = raw.replace(/\s+/g, '');
      if (raw.includes('@')) return 'email';
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(compact)) {
        return 'aleatoria';
      }

      const digits = this.onlyPixDigits(raw);
      const hasOnlyNumericSymbols = /^[\d.\-/()\s+]+$/.test(raw);
      if (!digits || !hasOnlyNumericSymbols) return '';

      const hasCpfMask = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(compact);
      const hasCnpjMask = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(compact);
      if (hasCpfMask) return 'cpf';
      if (hasCnpjMask) return 'cnpj';

      const hasPhoneCountryCode = raw.startsWith('+') || ((digits.length === 12 || digits.length === 13) && digits.startsWith('55'));
      const hasPhoneMask = /\(\s*\d{2}\s*\)/.test(raw) || (/[()\s-]/.test(raw) && (digits.length === 10 || digits.length === 11 || digits.length === 12));
      if (hasPhoneCountryCode || hasPhoneMask || (digits.length === 12 && digits.startsWith('0'))) return 'telefone';

      if (digits.length === 11 && (hasCpfMask || (!/[()\s-]/.test(raw) && this.isValidCpfDigits(digits)))) {
        return 'cpf';
      }
      if (digits.length === 14 && (hasCnpjMask || this.isValidCnpjDigits(digits))) return 'cnpj';
      if (digits.length === 10 || digits.length === 11) return 'telefone';
      return '';
    },

    normalizePixKeyForBrCode(value, type = '') {
      const raw = String(value || '').trim();
      if (!raw) return '';

      const compact = raw.replace(/\s+/g, '');
      const pixType = this.normalizePixKeyType(type) || this.detectPixKeyType(raw);
      if (pixType === 'email') return compact.toLowerCase();
      if (pixType === 'aleatoria') return compact.toLowerCase();

      const digits = this.onlyPixDigits(raw);
      if (pixType === 'cpf') return this.isValidCpfDigits(digits) ? digits : '';
      if (pixType === 'cnpj') return this.isValidCnpjDigits(digits) ? digits : '';
      if (pixType === 'telefone') {
        if (!digits) return '';
        if (raw.startsWith('+') || ((digits.length === 12 || digits.length === 13) && digits.startsWith('55'))) return `+${digits}`;
        if (digits.length === 12 && digits.startsWith('0')) return `+55${digits.slice(1)}`;
        if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
        return compact;
      }

      if (raw.includes('@')) return compact.toLowerCase();
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(compact)) {
        return compact.toLowerCase();
      }
      return /^[\d.\-/()\s+]+$/.test(raw) ? digits : compact;
    },

    normalizePixBrCodeText(value, maxLength) {
      const normalized = String(value || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
      return normalized.slice(0, maxLength);
    },

    parseMoedaPix(value) {
      if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
      const raw = String(value || '').trim();
      if (!raw) return 0;
      const cleaned = raw.replace(/[^\d,.-]/g, '');
      const normalized = cleaned.includes(',')
        ? cleaned.replace(/\./g, '').replace(',', '.')
        : cleaned;
      const parsed = Number.parseFloat(normalized);
      return Number.isFinite(parsed) ? parsed : 0;
    },

    formatPixAmount(value) {
      const amount = this.parseMoedaPix(value);
      return amount > 0 ? amount.toFixed(2) : '';
    },

    pixTlv(id, value) {
      const text = String(value == null ? '' : value);
      return `${id}${String(text.length).padStart(2, '0')}${text}`;
    },

    crc16CcittFalse(payload) {
      let crc = 0xFFFF;
      for (let index = 0; index < payload.length; index += 1) {
        crc ^= payload.charCodeAt(index) << 8;
        for (let bit = 0; bit < 8; bit += 1) {
          crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
          crc &= 0xFFFF;
        }
      }
      return crc.toString(16).toUpperCase().padStart(4, '0');
    },

    buildBrCode(data = {}) {
      const pixKey = this.normalizePixKeyForBrCode(data.pix, data.pixTipo || data.tipoPix || data.tipoChavePix);
      if (!pixKey) return '';
      const favorecido = this.normalizePixBrCodeText(data.favorecido || 'FAVORECIDO PIX', 25) || 'FAVORECIDO PIX';
      const cidade = this.normalizePixBrCodeText(data.cidade || 'BRASILIA', 15) || 'BRASILIA';
      const amount = this.formatPixAmount(data.valor != null ? data.valor : data.liquido);
      const txId = this.normalizePixBrCodeText(data.txid || data.txId || '***', 25);
      
      const merchantAccount = [
        this.pixTlv('00', 'br.gov.bcb.pix'),
        this.pixTlv('01', pixKey)
      ].join('');
      
      const additionalData = this.pixTlv('05', txId);
      
      const fields = [
        this.pixTlv('00', '01'),
        this.pixTlv('01', '11'),
        this.pixTlv('26', merchantAccount),
        this.pixTlv('52', '0000'),
        this.pixTlv('53', '986')
      ];
      
      if (amount) fields.push(this.pixTlv('54', amount));
      fields.push(
        this.pixTlv('58', 'BR'),
        this.pixTlv('59', favorecido),
        this.pixTlv('60', cidade),
        this.pixTlv('62', additionalData)
      );
      
      const payloadSemCrc = `${fields.join('')}6304`;
      return `${payloadSemCrc}${this.crc16CcittFalse(payloadSemCrc)}`;
    },

    validateCompanyPix(profile) {
      const missing = [];
      if (!profile) {
        return { valid: false, missing: ['profile'] };
      }
      if (!profile.pixChaveCobranca) missing.push('pixChaveCobranca');
      if (!profile.pixTipoChaveCobranca) missing.push('pixTipoChaveCobranca');
      if (!profile.pixFavorecidoCobranca) missing.push('pixFavorecidoCobranca');
      if (!profile.pixBancoCobranca) missing.push('pixBancoCobranca');
      return {
        valid: missing.length === 0,
        missing
      };
    }
  };

  if (typeof window !== 'undefined') {
    window.PixBrCode = PixBrCode;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PixBrCode;
  }
})();
