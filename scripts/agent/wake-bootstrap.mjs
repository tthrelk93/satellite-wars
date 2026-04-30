#!/usr/bin/env node
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const runNodeJson = (relativeScriptPath) => JSON.parse(
  execFileSync(
    'node',
    [path.join(repoRoot, relativeScriptPath)],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit']
    }
  )
);

const recovery = runNodeJson('scripts/agent/recover-interrupted-cycle.mjs');
const workerBrief = runNodeJson('scripts/agent/build-worker-brief.mjs');

process.stdout.write(`${JSON.stringify({
  schema: 'satellite-wars.worker-wake-bootstrap.v1',
  generatedAt: new Date().toISOString(),
  recovery,
  workerBrief
}, null, 2)}\n`);
