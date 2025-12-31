import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const srcRoot = path.join(repoRoot, 'src');
const weatherRoot = path.join(srcRoot, 'weather');

const forbiddenFiles = [
  'core.js',
  'advect.js',
  'clouds.js',
  'convection.js',
  'diagnostics.js',
  'dyn2layer.js',
  'dynamics.js',
  'microphysics.js',
  'surface.js',
  'vertical.js',
  'geo.js',
  'renderer.js',
  'tropicalCyclones.js',
  'fields.js'
].map(name => path.join(weatherRoot, name));

const forbiddenImports = [
  'core',
  'advect',
  'clouds',
  'convection',
  'diagnostics',
  'dyn2layer',
  'dynamics',
  'microphysics',
  'surface',
  'vertical',
  'geo',
  'renderer',
  'tropicalCyclones',
  'fields'
];

const fileErrors = [];
for (const filePath of forbiddenFiles) {
  if (fs.existsSync(filePath)) {
    fileErrors.push(`Forbidden file exists: ${path.relative(repoRoot, filePath)}`);
  }
}

const importErrors = [];
const importPattern = new RegExp(`['"]\\.?\\.?/weather/(?:${forbiddenImports.join('|')})(?:\\.js)?['"]`, 'g');

const walk = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (!['.js', '.jsx', '.mjs', '.ts', '.tsx'].includes(ext)) continue;
      const content = fs.readFileSync(fullPath, 'utf8');
      const matches = content.match(importPattern);
      if (matches) {
        importErrors.push(`${path.relative(repoRoot, fullPath)}: ${matches.join(', ')}`);
      }
    }
  }
};

walk(srcRoot);

if (fileErrors.length || importErrors.length) {
  console.error('no-v1-weather: FAILED');
  for (const err of fileErrors) console.error(err);
  for (const err of importErrors) console.error(`Forbidden import: ${err}`);
  process.exit(1);
}

console.log('no-v1-weather: OK');
