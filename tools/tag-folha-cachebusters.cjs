const c = require('crypto');
const f = require('fs');
const mods = ['folha-utils.js','folha-config.js','folha-calculos.js','folha-firebase-manager.js','folha-firebase-optimized.js','folha-funcionarios.js','folha-cargos.js','folha-lancamentos.js','folha-relatorios.js','folha-filtros.js','folha-paginacao.js','folha-main.js'];
let s = f.readFileSync('folha_pagamento/folha.html', 'utf8');
let n = 0;
for (const m of mods) {
  const h = c.createHash('sha256').update(f.readFileSync('folha_pagamento/' + m)).digest('hex').slice(0, 12);
  const from = 'src="' + m + '"';
  if (s.includes(from)) {
    s = s.split(from).join('src="' + m + '?v=' + h + '"');
    n++;
    console.log('tagged', m, h);
  } else {
    console.log('SKIP', m);
  }
}
f.writeFileSync('folha_pagamento/folha.html', s, 'utf8');
console.log('total tagged: ' + n);
