import fs from 'fs/promises';
import path from 'path';
import { normalizeGrid } from './grid.mjs';

export const DEFAULT_CASE_MANIFEST = path.resolve(process.cwd(), 'weather-validation/cases/fixture-synoptic/manifest.json');

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

export async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function writeText(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, value, 'utf8');
}

export function resolveRelativePath(baseFilePath, maybeRelativePath) {
  if (!maybeRelativePath) return null;
  return path.isAbsolute(maybeRelativePath)
    ? maybeRelativePath
    : path.resolve(path.dirname(baseFilePath), maybeRelativePath);
}

export async function loadCaseManifest(manifestPath = DEFAULT_CASE_MANIFEST) {
  const absolutePath = path.resolve(manifestPath);
  const manifest = await readJson(absolutePath);
  if (!manifest?.caseId) {
    throw new Error(`Case manifest ${absolutePath} is missing caseId.`);
  }
  if (!Array.isArray(manifest.leadHours) || !manifest.leadHours.length) {
    throw new Error(`Case manifest ${absolutePath} is missing leadHours.`);
  }

  return {
    manifestPath: absolutePath,
    manifest: {
      ...manifest,
      simulatorGrid: normalizeGrid(manifest.simulatorGrid),
      model: {
        ...manifest.model,
        fieldsPath: resolveRelativePath(absolutePath, manifest.model?.fieldsPath),
        stormTrackPath: resolveRelativePath(absolutePath, manifest.model?.stormTrackPath)
      },
      analysis: {
        ...manifest.analysis,
        fieldsPath: resolveRelativePath(absolutePath, manifest.analysis?.fieldsPath),
        stormTrackPath: resolveRelativePath(absolutePath, manifest.analysis?.stormTrackPath)
      },
      reference: {
        ...manifest.reference,
        fieldsPath: resolveRelativePath(absolutePath, manifest.reference?.fieldsPath),
        stormTrackPath: resolveRelativePath(absolutePath, manifest.reference?.stormTrackPath)
      }
    }
  };
}

export async function loadFieldDataset(filePath) {
  if (!filePath) return null;
  const dataset = await readJson(filePath);
  if (!Array.isArray(dataset?.leads)) {
    throw new Error(`Field dataset ${filePath} must define a leads array.`);
  }
  return {
    ...dataset,
    grid: normalizeGrid(dataset.grid)
  };
}

export async function loadStormTrackDataset(filePath) {
  if (!filePath) return null;
  return readJson(filePath);
}

export function mapLeadsByHour(dataset) {
  const byHour = new Map();
  (dataset?.leads || []).forEach((lead) => {
    if (!Number.isFinite(lead?.leadHours)) return;
    byHour.set(lead.leadHours, lead);
  });
  return byHour;
}
