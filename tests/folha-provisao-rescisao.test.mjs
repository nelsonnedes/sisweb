import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("provisao de rescisao detalhada implementa modo individual TRCT e modo consolidado com verbas completas", () => {
  const folhaRelatorios = read("folha_pagamento/folha-relatorios.js");

  // Verifica se a função contempla ambos os modos
  assert.match(folhaRelatorios, /async gerarRelatorioProvisaoRescisaoDetalhada\(dataInicio, dataFim, filtroFuncionario = \{\}\)/);
  assert.match(folhaRelatorios, /const isIndividual = !filtroFuncionario\.todosFuncionarios && funcionarios\.length === 1;/);

  // Verifica cálculo de Aviso Prévio com Lei 12.506/2011
  assert.match(folhaRelatorios, /const diasAvisoPrevio = Math\.min\(90, 30 \+ \(anosCompletos \* 3\)\);/);
  assert.match(folhaRelatorios, /const valorAvisoPrevio = valorDia \* diasAvisoPrevio;/);

  // Verifica Saldo de Salário com dedução de Faltas e DSR
  assert.match(folhaRelatorios, /const diasFaltas = Number\(lancamento\.faltas \|\| 0\);/);
  assert.match(folhaRelatorios, /const diasAtestados = Number\(lancamento\.atestados \|\| 0\);/);
  assert.match(folhaRelatorios, /const diasTrabalhados = Math\.max\(0, Math\.min\(30, 30 - diasFaltas\)\);/);
  assert.match(folhaRelatorios, /const valorSaldoSalario = valorDia \* diasTrabalhados;/);
  assert.match(folhaRelatorios, /const valorDescontoFaltas = valorDia \* diasFaltas;/);

  // Verifica 13º Salário e Férias com terço constitucional
  assert.match(folhaRelatorios, /const valor13Proporcional = \(salarioBase \/ 12\) \* avos13Prop;/);
  assert.match(folhaRelatorios, /const valorFeriasProporcionais = \(salarioBase \/ 12\) \* avosFeriasProp;/);
  assert.match(folhaRelatorios, /const tercoFeriasProp = valorFeriasProporcionais \/ 3;/);

  // Verifica FGTS e Multa Rescisória (40%)
  assert.match(folhaRelatorios, /const multaFgts = fgtsBaseTotal \* 0\.40;/);
  assert.match(folhaRelatorios, /const valorLiquido = Math\.max\(0, totalProventos - totalDescontos\);/);

  // Verifica layout TRCT Individual com identificação, rubricas e assinaturas
  assert.match(folhaRelatorios, /DEMONSTRATIVO DE PROVISÃO DE RESCISÃO CONTRATUAL/);
  assert.match(folhaRelatorios, /Identificação do Empregador/);
  assert.match(folhaRelatorios, /Identificação do Trabalhador/);
  assert.match(folhaRelatorios, /1\. VERBAS RESCISÓRIAS \(PROVENTOS\)/);
  assert.match(folhaRelatorios, /2\. DEDUÇÕES E DESCONTOS/);
  assert.match(folhaRelatorios, /Valor Líquido a Receber na Rescisão/);
  assert.match(folhaRelatorios, /Provisão de FGTS & Multa Rescisória \(40%\)/);
  assert.match(folhaRelatorios, /Assinatura do Trabalhador \/ Colaborador/);

  // Verifica layout Consolidado
  assert.match(folhaRelatorios, /RELATÓRIO CONSOLIDADO DE PROVISÃO DE RESCISÃO DETALHADA/);
  assert.match(folhaRelatorios, /TOTAL GERAL CONSOLIDADO:/);
});
