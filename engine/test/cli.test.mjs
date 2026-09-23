import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const cli = fileURLToPath(new URL('../cli.mjs', import.meta.url));
const example = fileURLToPath(new URL('../examples/decisions.json', import.meta.url));
const run = (args, input) => spawnSync(process.execPath, [cli, ...args], {encoding: 'utf8', input});

test('CLI demo and JSON file reproduce the same 95-unit result', () => {
  const demo = run(['--demo']);
  const file = run([example]);
  assert.equal(demo.status, 0);
  assert.equal(file.status, 0);
  assert.equal(demo.stderr, '');
  assert.deepEqual(JSON.parse(demo.stdout), JSON.parse(file.stdout));
  assert.equal(JSON.parse(file.stdout).result.after.score, 56.54307);
});

test('CLI baseline is distinct from an invalid empty submission', () => {
  const baseline = run(['--baseline']);
  assert.equal(baseline.status, 0);
  assert.equal(JSON.parse(baseline.stdout).score, 52.55768);
  const invalid = run(['-'], '[]');
  assert.equal(invalid.status, 1);
  assert.equal(JSON.parse(invalid.stdout).result, null);
});

test('CLI handles malformed JSON and nonexistent files with exit code 2', () => {
  for (const response of [run(['-'], '{broken'), run([`${example}.missing`])]) {
    assert.equal(response.status, 2);
    assert.equal(response.stdout, '');
    assert.equal(JSON.parse(response.stderr).error, 'INPUT_ERROR');
  }
});

test('CLI documents usage and rejects surplus arguments', () => {
  assert.equal(run(['--help']).status, 0);
  assert.equal(run([]).status, 2);
  assert.equal(run(['--demo', '--baseline']).status, 2);
});
