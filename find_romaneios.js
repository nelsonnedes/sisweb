
const fs = require('fs');
const fileName = 'sisweb-7ce82-default-rtdb-export (4).json';

try {
  const data = JSON.parse(fs.readFileSync(fileName, 'utf8'));
  const companyId = '1749492103278';
  if (data.companies && data.companies[companyId] && data.companies[companyId].romaneios) {
    console.log('Found romaneios!');
    const romaneios = data.companies[companyId].romaneios;
    console.log(JSON.stringify(romaneios, null, 2).substring(0, 5000));
  } else {
    console.log('Romaneios not found at expected path');
    console.log('Keys under company:', Object.keys(data.companies[companyId]));
  }
} catch (e) {
  console.error(e);
}
