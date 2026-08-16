import fs from 'fs';
import * as acorn from 'acorn';

const files = ['romaneiopes.html', 'romaneiotl.html', 'romaneiopct.html', 'romaneiotora.html', 'preromaneio.html'];

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const scriptRegex = /<script(\b[^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  let i = 1;
  let errors = 0;
  console.log(`\n--- Validando ${file} ---`);
  while ((match = scriptRegex.exec(html)) !== null) {
    const attrs = match[1];
    const code = match[2].trim();
    if (code && !attrs.includes('src=')) {
      const isModule = attrs.includes('type="module"') || attrs.includes("type='module'") || attrs.includes('type=module');
      try {
        acorn.parse(code, { ecmaVersion: 'latest', sourceType: isModule ? 'module' : 'script' });
        console.log(`  Script ${i} (${isModule ? 'module' : 'script'}): OK (${code.length} chars)`);
      } catch (e) {
        console.error(`  ❌ Script ${i} SYNTAX ERROR at line ${e.loc?.line}, col ${e.loc?.column}: ${e.message}`);
        errors++;
      }
    }
    i++;
  }
  if (errors === 0) {
    console.log(`✅ ${file}: 100% livre de erros de sintaxe!`);
  } else {
    console.error(`❌ ${file}: ${errors} erros encontrados!`);
  }
}
