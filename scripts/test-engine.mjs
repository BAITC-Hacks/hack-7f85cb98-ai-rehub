import {readdirSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
function collect(path) {
  return readdirSync(path, {withFileTypes: true}).flatMap(entry => {
    const file = join(path, entry.name);
    return entry.isDirectory() ? collect(file) : file.endsWith('.test.ts') ? [file] : [];
  }).sort();
}
const files = process.argv.length > 2 ? process.argv.slice(2) : collect('tests');
if (!files.length) {
  console.error('NOT_IMPLEMENTED: TS implementation tests have not been delivered yet. Run npm run test:legacy to check the published reference.');
  process.exitCode = 2;
} else {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', ...files], {stdio: 'inherit'});
  if (result.error) console.error(result.error.message);
  process.exitCode = result.status ?? 1;
}
