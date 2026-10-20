import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('scripts/romaneios-referencias-migrate.cjs', 'utf8');

test('referencias: escreve sob companies/{tenant} e exige backup no apply', () => {
  assert.match(source, /scan\(company\[root\], `companies\/\$\{tenant\}\/\$\{root\}`/);
  assert.match(source, /--apply exige --backup/);
  assert.doesNotMatch(source, /sisweb-7ce82-default-rtdb[^\n]*service-account/);
});
