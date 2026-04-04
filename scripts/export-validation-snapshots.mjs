#!/usr/bin/env node
import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { writeJson } from '../weather-validation/lib/io.mjs';

const args = process.argv.slice(2);
const inputPath = args[0];
let outputPath = null;

for (let i = 1; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--out' && args[i + 1]) {
    outputPath = args[i + 1];
    i += 1;
  } else if (arg.startsWith('--out=')) {
    outputPath = arg.slice('--out='.length);
  }
}

if (!inputPath) {
  console.error('Usage: node scripts/export-validation-snapshots.mjs <weather-log.jsonl> [--out path/to/fields.json]');
  process.exit(1);
}

const resolvedInput = path.resolve(inputPath);
const resolvedOutput = path.resolve(outputPath || 'weather-validation/output/exported-validation-fields.json');
const stream = fs.createReadStream(resolvedInput, { encoding: 'utf8' });
const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

let baseSimTimeSeconds = null;
let grid = null;
let pressureLevelsPa = null;
const leads = [];

for await (const line of rl) {
  const trimmed = line.trim();
  if (!trimmed) continue;
  let entry = null;
  try {
    entry = JSON.parse(trimmed);
  } catch (_) {
    continue;
  }
  if (entry.event !== 'validationSnapshot' || !entry.payload) continue;
  const payload = entry.payload;
  if (!grid && payload.grid) grid = payload.grid;
  if (!pressureLevelsPa && Array.isArray(payload.pressureLevelsPa)) pressureLevelsPa = payload.pressureLevelsPa.slice();
  const simTimeSeconds = entry.sim?.simTimeSeconds ?? payload.simTimeSeconds ?? null;
  if (!Number.isFinite(baseSimTimeSeconds) && Number.isFinite(simTimeSeconds)) {
    baseSimTimeSeconds = simTimeSeconds;
  }
  const derivedLeadHours = Number.isFinite(entry.leadHours)
    ? entry.leadHours
    : (Number.isFinite(simTimeSeconds) && Number.isFinite(baseSimTimeSeconds)
      ? Math.round((simTimeSeconds - baseSimTimeSeconds) / 3600)
      : 0);
  leads.push({
    leadHours: derivedLeadHours,
    seaLevelPressurePa: payload.seaLevelPressurePa,
    surfacePressurePa: payload.surfacePressurePa,
    wind10mU: payload.wind10mU,
    wind10mV: payload.wind10mV,
    geopotentialHeightMByPressurePa: payload.geopotentialHeightMByPressurePa,
    totalColumnWaterKgM2: payload.totalColumnWaterKgM2,
    precipRateMmHr: payload.precipRateMmHr,
    precipAccumMm: payload.precipAccumMm,
    cloudLowFraction: payload.cloudLowFraction,
    cloudHighFraction: payload.cloudHighFraction,
    cloudTotalFraction: payload.cloudTotalFraction
  });
}

if (!grid || !leads.length) {
  console.error('No validationSnapshot events found in log.');
  process.exit(1);
}

leads.sort((a, b) => a.leadHours - b.leadHours);
await writeJson(resolvedOutput, {
  schema: 'satellite-wars.weather-validation.fields.v1',
  grid,
  pressureLevelsPa: pressureLevelsPa || [50000],
  leads
});

console.log(`Exported ${leads.length} validation snapshots to ${resolvedOutput}`);
