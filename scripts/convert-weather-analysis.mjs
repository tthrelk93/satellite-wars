#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';

const args = process.argv.slice(2);
const getArg = (name, fallback = null) => {
  const idx = args.indexOf(name);
  if (idx >= 0 && args[idx + 1]) return args[idx + 1];
  const prefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : fallback;
};

const inputPath = getArg('--in');
const outputPath = getArg('--out');
const caseIdArg = getArg('--case-id');

if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/convert-weather-analysis.mjs --in raw.json --out public/analysis/case.json [--case-id my-case]');
  process.exit(1);
}

const raw = JSON.parse(await fs.readFile(path.resolve(inputPath), 'utf8'));
const dataset = {
  schema: 'satellite-wars.weather-analysis.case.v1',
  caseId: caseIdArg || raw.caseId || 'analysis-case',
  validTime: raw.validTime || null,
  description: raw.description || null,
  grid: raw.grid,
  fields: raw.fields || raw.variables || {}
};

await fs.mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
await fs.writeFile(path.resolve(outputPath), `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');
console.log(`Wrote ${path.resolve(outputPath)}`);
