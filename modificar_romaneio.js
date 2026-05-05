// Script para modificar o arquivo romaneiopct_modais.js
const fs = require('fs');
const path = require('path');

// Ler o arquivo original
console.log('Lendo o arquivo original...');
const filePath = path.join(__dirname, 'romaneiopct_modais.js.bak');
let content = fs.readFileSync(filePath, 'utf8');

// Modificações

// 1. Remover declarações de variáveis para metros lineares e volume m²
console.log('Removendo declarações de variáveis...');
content = content.replace(
    /let totalMetrosLineares = 0;\s+let totalVolumeM2 = 0;/g,
    '// Variáveis removidas: totalMetrosLineares e totalVolumeM2'
);

// 2. Modificar as linhas que processam os itens da tabela para remover metrosLineares e volumeM2
console.log('Modificando processamento de itens...');
content = content.replace(
    /let totalItem = totalPecasComprimentos;\s+let metrosLineares = item\.metrosLineares;\s+let volumeM2 = item\.volumeM2;\s+let volumeM3 = item\.volumeM3;/g,
    'let totalItem = totalPecasComprimentos;\nlet volumeM3 = item.volumeM3;'
);

// 3. Modificar as linhas que acumulam totais para não acumular mais metrosLineares e volumeM2
console.log('Modificando acumulação de totais...');
content = content.replace(
    /totalPecasGeral \+= totalItem;\s+totalMetrosLineares \+= metrosLineares;\s+totalVolumeM2 \+= volumeM2;\s+totalVolumeM3 \+= volumeM3;/g,
    'totalPecasGeral += totalItem;\ntotalVolumeM3 += volumeM3;'
);

// 4. Modificar as constantes que usam os totais
console.log('Modificando constantes de totais...');
content = content.replace(
    /const totalPecasExemplo = totalPecasGeral;\s+const totalMetrosExemplo = totalMetrosLineares;\s+const totalVolumeM2Exemplo = totalVolumeM2;\s+const totalVolumeM3Exemplo = totalVolumeM3;/g,
    'const totalPecasExemplo = totalPecasGeral;\nconst totalVolumeM3Exemplo = totalVolumeM3;'
);

// Salvar o arquivo modificado
console.log('Salvando o arquivo modificado...');
const outputPath = path.join(__dirname, 'romaneiopct_modais_modified.js');
fs.writeFileSync(outputPath, content, 'utf8');

console.log('Operação concluída!');
console.log(`Arquivo original: ${filePath}`);
console.log(`Arquivo modificado: ${outputPath}`);
