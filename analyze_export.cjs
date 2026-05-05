
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'sisweb-7ce82-default-rtdb-export (4).json');

try {
  const data = fs.readFileSync(filePath, 'utf8');
  const json = JSON.parse(data);

  // Navigate to companies -> [id] -> romaneios -> tora
  const companies = json.companies;
  if (!companies) {
    console.log('No companies found');
  } else {
    for (const companyId in companies) {
      const company = companies[companyId];
      if (company.romaneios && company.romaneios.tora) {
        console.log(`Found romaneios/tora for company ${companyId}:`);
        console.log(JSON.stringify(company.romaneios.tora, null, 2));
      } else {
        console.log(`Company ${companyId} has no romaneios/tora`);
        if (company.romaneiosTora) {
            console.log(`Found legacy romaneiosTora for company ${companyId}:`);
            console.log(JSON.stringify(company.romaneiosTora, null, 2));
        }
      }
    }
  }
} catch (err) {
  console.error('Error reading file:', err);
}
