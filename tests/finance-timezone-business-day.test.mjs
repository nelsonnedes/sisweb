import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { __test } = require('../functions/finance-functions.js');

const { getTodayISODateInTimeZone, todayDayNumber, currentFinancialState } = __test;

// Cenários no fuso America/Sao_Paulo (UTC-3, sem horário de verão desde 2019).
// Às 21h locais de 2026-08-14, o relógio UTC já é 2026-08-15. O dia civil do
// negócio deve permanecer 2026-08-14 (regressão da correção UTC do Antigravity).

test('getTodayISODateInTimeZone mantém o dia civil local após as 21h (UTC já no dia seguinte)', () => {
  const at21hLocal = '2026-08-15T00:00:00.000Z'; // = 14/08 às 21h em São Paulo
  assert.equal(getTodayISODateInTimeZone(at21hLocal, 'America/Sao_Paulo'), '2026-08-14');
});

test('getTodayISODateInTimeZone acompanha o dia quando a virada já passou', () => {
  const manhaSeguinte = '2026-08-15T03:30:00.000Z'; // = 15/08 às 00:30 em São Paulo
  assert.equal(getTodayISODateInTimeZone(manhaSeguinte, 'America/Sao_Paulo'), '2026-08-15');
});

test('todayDayNumber usa o dia civil do negócio, não o dia UTC', () => {
  // 21h locais de 14/08: dia civil 14, mesmo o UTC sendo 15.
  const dayAt21h = todayDayNumber('2026-08-15T00:00:00.000Z');
  const dayDue = todayDayNumber('2026-08-14T12:00:00.000Z');
  assert.equal(dayDue, dayAt21h, 'conta vencendo hoje não deve virar 1 dia de atraso às 21h');
});

test('currentFinancialState marca como pendente conta que vence hoje às 21h locais', () => {
  const account = {
    dataVencimento: '2026-08-14',
    valorOriginal: 100,
    valor: 100,
    valorRestante: 100,
    valorPago: 0,
    status: 'pendente',
    historicosPagamento: [],
  };
  const at21hLocal = '2026-08-15T00:00:00.000Z'; // UTC já 15, mas dia civil SP 14
  const state = currentFinancialState(account, at21hLocal);
  assert.equal(state.status, 'pendente');
});

test('currentFinancialState marca como vencido apenas quando a virada civil passou', () => {
  const account = {
    dataVencimento: '2026-08-14',
    valorOriginal: 100,
    valor: 100,
    valorRestante: 100,
    valorPago: 0,
    status: 'pendente',
    historicosPagamento: [],
  };
  const depoisDaMeiaNoite = '2026-08-15T03:30:00.000Z'; // 15/08 às 00:30 em SP
  const state = currentFinancialState(account, depoisDaMeiaNoite);
  assert.equal(state.status, 'vencido');
});
