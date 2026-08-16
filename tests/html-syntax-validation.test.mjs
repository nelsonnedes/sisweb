import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as acorn from 'acorn';

test('HTML inline scripts syntax validation', async (t) => {
  const htmlFiles = [
    'romaneiopes.html',
    'romaneiotl.html',
    'romaneiopct.html',
    'romaneiotora.html',
    'preromaneio.html',
    'dashboard.html',
    'estoque.html',
    'vendas.html',
    'financas.html'
  ];

  for (const file of htmlFiles) {
    const filePath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(filePath)) continue;

    await t.test(`Validação de sintaxe dos scripts de ${file}`, () => {
      const html = fs.readFileSync(filePath, 'utf8');
      const scriptRegex = /<script(\b[^>]*)>([\s\S]*?)<\/script>/gi;
      let match;
      let i = 1;
      let errors = [];

      while ((match = scriptRegex.exec(html)) !== null) {
        const attrs = match[1];
        const code = match[2].trim();
        if (code && !attrs.includes('src=')) {
          const isModule = attrs.includes('type="module"') || attrs.includes("type='module'") || attrs.includes('type=module');
          try {
            acorn.parse(code, { ecmaVersion: 'latest', sourceType: isModule ? 'module' : 'script' });
          } catch (e) {
            errors.push(`Script ${i} (linha HTML aprox.) Erro: ${e.message} at line ${e.loc?.line}, col ${e.loc?.column}`);
          }
        }
        i++;
      }

      assert.strictEqual(errors.length, 0, `Erros de sintaxe encontrados em ${file}:\n${errors.join('\n')}`);
    });
  }
});
