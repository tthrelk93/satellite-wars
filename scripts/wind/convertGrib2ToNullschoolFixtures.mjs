import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const REPO_ROOT = process.cwd();
const INPUT_DIR = path.join(REPO_ROOT, 'downloads');
const OUTPUT_DIR = path.join(REPO_ROOT, 'tools', 'wind-fixtures', 'gfs10m');

const NX = 360;
const NY = 181;
const DX = 1;
const DY = 1;
const LA1 = 90;
const LO1 = 0;
const GRID_COUNT = NX * NY;

const requireBinary = async (name) => {
  const envPath = process.env.PATH || '';
  const candidates = envPath.split(path.delimiter).map((p) => path.join(p, name));
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // keep searching
    }
  }
  throw new Error(`Missing required binary: ${name}. Install eccodes (grib_get/grib_get_data).`);
};

const runCapture = (cmd, args) => new Promise((resolve, reject) => {
  const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  proc.stdout.setEncoding('utf8');
  proc.stderr.setEncoding('utf8');
  proc.stdout.on('data', (chunk) => { stdout += chunk; });
  proc.stderr.on('data', (chunk) => { stderr += chunk; });
  proc.on('error', reject);
  proc.on('close', (code) => {
    if (code === 0) return resolve({ stdout, stderr });
    reject(new Error(`${cmd} exited ${code}: ${stderr || stdout}`));
  });
});

const readFieldValues = async ({ gribGetDataPath, filePath, shortName }) => {
  return new Promise((resolve, reject) => {
    const proc = spawn(gribGetDataPath, ['-w', `shortName=${shortName}`, filePath], { stdio: ['ignore', 'pipe', 'pipe'] });
    proc.stdout.setEncoding('utf8');
    proc.stderr.setEncoding('utf8');
    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk; });

    const values = new Float32Array(GRID_COUNT);
    const filled = new Uint8Array(GRID_COUNT);
    let filledCount = 0;
    let lineBuf = '';
    let isHeader = true;

    const handleLine = (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (isHeader) {
        isHeader = false;
        return;
      }
      const parts = trimmed.split(/\s+/);
      if (parts.length < 3) return;
      const lat = Number.parseFloat(parts[0]);
      const lon = Number.parseFloat(parts[1]);
      const val = Number.parseFloat(parts[2]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(val)) return;
      const i = ((Math.round(lon) % NX) + NX) % NX;
      const j = Math.round(LA1 - lat);
      if (j < 0 || j >= NY) return;
      const idx = j * NX + i;
      if (filled[idx] === 0) {
        filled[idx] = 1;
        filledCount += 1;
      }
      values[idx] = val;
    };

    proc.stdout.on('data', (chunk) => {
      lineBuf += chunk;
      while (true) {
        const nl = lineBuf.indexOf('\n');
        if (nl < 0) break;
        const line = lineBuf.slice(0, nl);
        lineBuf = lineBuf.slice(nl + 1);
        handleLine(line);
      }
    });

    proc.stdout.on('end', () => {
      if (lineBuf) handleLine(lineBuf);
    });

    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`grib_get_data failed (${shortName}): ${stderr}`));
        return;
      }
      if (filledCount !== GRID_COUNT) {
        reject(new Error(`Expected ${GRID_COUNT} grid points for ${shortName}, got ${filledCount}`));
        return;
      }
      resolve(values);
    });
  });
};

const listInputFiles = async () => {
  const entries = await fs.readdir(INPUT_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.f000'))
    .map((e) => path.join(INPUT_DIR, e.name))
    .sort();
};

const parseRunInfo = async ({ gribGetPath, filePath }) => {
  const { stdout } = await runCapture(gribGetPath, ['-w', 'shortName=10u', '-p', 'dataDate,dataTime,stepRange', filePath]);
  const parts = stdout.trim().split(/\s+/);
  if (parts.length < 3) throw new Error(`Unexpected grib_get output: ${stdout}`);
  const dataDate = parts[0];
  const dataTime = parts[1];
  const stepRange = parts[2];
  const hh = String(Math.floor(Number.parseInt(dataTime, 10) / 100)).padStart(2, '0');
  const step = String(Number.parseInt(stepRange, 10)).padStart(3, '0');
  const outName = `gfs10m-${dataDate}-${hh}z-f${step}.json`;
  return { dataDate, dataTime, stepRange, outName };
};

const buildHeader = ({ dataDate, dataTime, stepRange, shortName }) => ({
  nx: NX,
  ny: NY,
  dx: DX,
  dy: DY,
  la1: LA1,
  lo1: LO1,
  dataDate: Number.parseInt(dataDate, 10),
  dataTime: Number.parseInt(dataTime, 10),
  forecastTime: Number.parseInt(stepRange, 10),
  parameterUnit: 'm/s',
  shortName
});

const main = async () => {
  const gribGetPath = await requireBinary('grib_get');
  const gribGetDataPath = await requireBinary('grib_get_data');

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const inputs = await listInputFiles();
  if (inputs.length === 0) {
    throw new Error(`No .f000 GRIB2 files found in ${INPUT_DIR}`);
  }
  console.log(`Found ${inputs.length} GRIB2 files in downloads/.`);

  for (const filePath of inputs) {
    const info = await parseRunInfo({ gribGetPath, filePath });
    const outPath = path.join(OUTPUT_DIR, info.outName);
    console.log(`Converting ${path.basename(filePath)} → ${path.relative(REPO_ROOT, outPath)}`);

    const u = await readFieldValues({ gribGetDataPath, filePath, shortName: '10u' });
    const v = await readFieldValues({ gribGetDataPath, filePath, shortName: '10v' });

    const uRec = { header: buildHeader({ ...info, shortName: '10u' }), data: Array.from(u) };
    const vRec = { header: buildHeader({ ...info, shortName: '10v' }), data: Array.from(v) };
    const json = JSON.stringify([uRec, vRec]);
    await fs.writeFile(outPath, json, 'utf8');
  }

  console.log('Done.');
  console.log(`Fixtures written to: ${path.relative(REPO_ROOT, OUTPUT_DIR)}`);
};

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});

