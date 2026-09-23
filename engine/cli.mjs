#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {simulateScenario, getBaseline, EXAMPLE_DECISIONS} from './index.mjs';

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || args[0] === '--help') {
    process.stdout.write('Usage: node engine/cli.mjs --demo | --baseline | decisions.json | -\n');
    process.exitCode = args[0] === '--help' ? 0 : 2;
    return;
  }
  if (args[0] === '--baseline') {
    process.stdout.write(`${JSON.stringify(getBaseline(), null, 2)}\n`);
    return;
  }
  let decisions;
  try {
    if (args[0] === '--demo') decisions = EXAMPLE_DECISIONS;
    else {
      let input;
      if (args[0] === '-') {
        input = '';
        for await (const chunk of process.stdin) input += chunk;
      } else input = await readFile(args[0], 'utf8');
      decisions = JSON.parse(input);
    }
  } catch (error) {
    process.stderr.write(`${JSON.stringify({error: 'INPUT_ERROR', message: error.message})}\n`);
    process.exitCode = 2;
    return;
  }
  const result = simulateScenario(decisions);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.valid) process.exitCode = 1;
}
await main();
