import { readFileSync } from 'node:fs';
import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function blockBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `bloco ${startMarker} precisa existir`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `fim ${endMarker} precisa existir`);
  return source.slice(start, end);
}

function loadPixBrCode() {
  const code = read('js/pix-brcode.js');
  const windowMock = {};
  const context = {
    window: windowMock,
    console: {
      log: () => {},
      warn: () => {},
      error: () => {},
    }
  };
  vm.runInNewContext(code, context, { filename: 'pix-brcode.js' });
  return context.window.PixBrCode;
}

function loadFinanceBoletoHelpers() {
    const source = read('financas.js');
    const helpersBlock = blockBetween(
      source,
      'function normalizeTipoKey',
      'function getCategoriaLabel'
    );
    const context = {
      window: {},
      console: {
        log: () => {},
        warn: () => {},
        error: () => {},
      }
    };
    vm.createContext(context);
    vm.runInContext(`${helpersBlock}
      this.helpers = {
        resolveFinanceTipoOperacional,
        shouldShowBoletoLamina
      };`, context, { filename: 'financas-boleto-helpers.vm.js' });
    return context.helpers;
}

describe('Lâmina de Cobrança PIX e Engine PIX Compartilhada', () => {
    const PixBrCode = loadPixBrCode();

    it('deve normalizar tipos de chaves PIX corretamente', () => {
        assert.equal(PixBrCode.normalizePixKeyType('CPF'), 'cpf');
        assert.equal(PixBrCode.normalizePixKeyType('CNPJ'), 'cnpj');
        assert.equal(PixBrCode.normalizePixKeyType('e-mail'), 'email');
        assert.equal(PixBrCode.normalizePixKeyType('telefone'), 'telefone');
        assert.equal(PixBrCode.normalizePixKeyType('aleatória'), 'aleatoria');
    });

    it('deve detectar tipo de chave aleatória/UUID', () => {
        const uuidChave = '123e4567-e89b-12d3-a456-426614174000';
        assert.equal(PixBrCode.detectPixKeyType(uuidChave), 'aleatoria');
    });

    it('deve formatar valor decimal corretamente para o payload', () => {
        assert.equal(PixBrCode.formatPixAmount(1500), '1500.00');
        assert.equal(PixBrCode.formatPixAmount('1.500,50'), '1500.50');
        assert.equal(PixBrCode.formatPixAmount(0), '');
    });

    it('deve validar dados de perfil da empresa para PIX', () => {
        const perfilInvalido = { name: 'Empresa XYZ' };
        const validation = PixBrCode.validateCompanyPix(perfilInvalido);
        assert.equal(validation.valid, false);
        assert.ok(validation.missing.includes('pixChaveCobranca'));

        const perfilValido = {
            pixChaveCobranca: '12345678000190',
            pixTipoChaveCobranca: 'cnpj',
            pixFavorecidoCobranca: 'EMPRESA XYZ',
            pixBancoCobranca: 'Nubank'
        };
        assert.equal(PixBrCode.validateCompanyPix(perfilValido).valid, true);
    });

    it('deve gerar payload BR Code válido com CRC16', () => {
        const data = {
            pix: '11999999999',
            tipoPix: 'telefone',
            favorecido: 'EMPRESA XYZ',
            cidade: 'BRASILIA',
            valor: 150.50,
            txId: 'TESTE123'
        };
        const payload = PixBrCode.buildBrCode(data);
        assert.ok(payload);
        assert.ok(payload.includes('br.gov.bcb.pix'));
        assert.equal(payload.slice(-4), PixBrCode.crc16CcittFalse(payload.slice(0, -4)));
    });

    it('deve manter o tipo operacional visível e bloquear boleto em contas a pagar', () => {
        const helpers = loadFinanceBoletoHelpers();
        assert.equal(helpers.resolveFinanceTipoOperacional({ tipo: 'pagar', tipoPagamento: 'boleto' }), 'boleto');
        assert.equal(helpers.resolveFinanceTipoOperacional({ tipo: 'receber', tipoPagamento: 'boleto' }), 'boleto');
        assert.equal(helpers.resolveFinanceTipoOperacional({ tipo: 'boleto' }), 'boleto');
        assert.equal(helpers.shouldShowBoletoLamina({ tipo: 'pagar', tipoPagamento: 'boleto' }, 'pagar'), false);
        assert.equal(helpers.shouldShowBoletoLamina({ tipo: 'boleto' }, 'receber'), true);
    });

    it('deve reutilizar o perfil tenant-safe preparado pelo Financeiro', () => {
        const financeSource = read('financas.js');
        const firebaseServiceSource = read('firebaseService.js');

        assert.match(financeSource, /async function abrirBoletoPixLamina[\s\S]*const empresa = await prepareFinanceReportCompany\(\)/);
        assert.doesNotMatch(financeSource, /loadFromFirebase\(`companies\/\$\{currentCompanyId\}\/profile`\)/);
        assert.match(firebaseServiceSource, /const pixChaveCobranca = firstReportValue\(source\.pixChaveCobranca\)/);
        assert.match(firebaseServiceSource, /normalized\.pixChaveCobranca = pixChaveCobranca/);
        assert.match(firebaseServiceSource, /normalized\.pixTipoChaveCobranca = pixTipoChaveCobranca/);
        assert.match(firebaseServiceSource, /normalized\.pixFavorecidoCobranca = pixFavorecidoCobranca/);
        assert.match(firebaseServiceSource, /normalized\.pixBancoCobranca = pixBancoCobranca/);
        const pdfSource = read('js/commerce-boleto-pix.js');
        assert.match(pdfSource, /company\.logoDataUrl/);
        assert.match(pdfSource, /getPdfImageFormat\(logoDataUrl\)/);
    });
});
