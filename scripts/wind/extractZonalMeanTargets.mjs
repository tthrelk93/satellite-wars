import fs from 'node:fs/promises';
import path from 'node:path';

const FIXTURE_DIR = path.join(process.cwd(), 'tools', 'wind-fixtures', 'gfs10m');
const OUTPUT_PATH = path.join(process.cwd(), 'src', 'weather', 'v2', 'windClimoTargets.js');
const REQUIRED_FIXTURE_COUNT = 8;

const formatFloat = (value) => (Number.isFinite(value) ? value.toFixed(6) : '0.000000');
const formatArray = (arr, perLine = 8) => {
  let out = '[\n';
  for (let i = 0; i < arr.length; i++) {
    out += `  ${formatFloat(arr[i])}`;
    if (i < arr.length - 1) out += ',';
    if ((i + 1) % perLine === 0) out += '\n';
    else out += ' ';
  }
  if (!out.endsWith('\n')) out += '\n';
  out += ']';
  return out;
};

const readFixtureFiles = async () => {
  let entries;
  try {
    entries = await fs.readdir(FIXTURE_DIR, { withFileTypes: true });
  } catch (err) {
    throw new Error(`Missing fixtures directory: ${FIXTURE_DIR}`);
  }
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort();
  if (files.length !== REQUIRED_FIXTURE_COUNT) {
    throw new Error(`Need 8 fixtures; found ${files.length}`);
  }
  return files;
};

const validateHeader = (header) => {
  const required = ['nx', 'ny', 'dx', 'dy', 'la1', 'lo1'];
  for (const key of required) {
    if (!Number.isFinite(header?.[key])) {
      throw new Error(`Missing wind header field: ${key}`);
    }
  }
  const { nx, ny, dx, dy, la1, lo1 } = header;
  if (nx !== 360 || ny !== 181 || dx !== 1 || dy !== 1 || la1 !== 90 || lo1 !== 0) {
    throw new Error('Unexpected wind grid header');
  }
};

const parseFixture = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');
  const json = JSON.parse(raw);
  if (!Array.isArray(json) || json.length < 2) {
    throw new Error('Invalid wind fixture format');
  }
  const [uRec, vRec] = json;
  const uHeader = uRec?.header;
  const vHeader = vRec?.header;
  if (!uHeader || !vHeader) {
    throw new Error('Missing wind header');
  }
  validateHeader(uHeader);
  validateHeader(vHeader);
  const fields = ['nx', 'ny', 'dx', 'dy', 'la1', 'lo1'];
  for (const field of fields) {
    if (uHeader[field] !== vHeader[field]) {
      throw new Error(`Wind header mismatch: ${field}`);
    }
  }
  const { nx, ny } = uHeader;
  const count = nx * ny;
  const uData = uRec?.data;
  const vData = vRec?.data;
  if (!Array.isArray(uData) || !Array.isArray(vData)) {
    throw new Error('Missing wind data arrays');
  }
  if (uData.length !== count || vData.length !== count) {
    throw new Error('Unexpected wind data length');
  }
  return { nx, ny, uData, vData };
};

const main = async () => {
  const files = await readFixtureFiles();
  let sumByLat = null;
  let sumEkeByLat = null;
  let sumVortRmsByLat = null;
  let nx = null;
  let ny = null;
  for (const file of files) {
    const filePath = path.join(FIXTURE_DIR, file);
    const fixture = await parseFixture(filePath);
    if (nx == null) {
      nx = fixture.nx;
      ny = fixture.ny;
      sumByLat = new Float64Array(ny);
      sumEkeByLat = new Float64Array(ny);
      sumVortRmsByLat = new Float64Array(ny);
    }
    if (fixture.nx !== nx || fixture.ny !== ny) {
      throw new Error(`Grid mismatch in fixture: ${file}`);
    }
    const rowMeanU = new Float64Array(ny);
    const rowMeanV = new Float64Array(ny);
    for (let j = 0; j < ny; j++) {
      let sum = 0;
      let sumV = 0;
      const row = j * nx;
      for (let i = 0; i < nx; i++) {
        sum += fixture.uData[row + i];
        sumV += fixture.vData[row + i];
      }
      const uMean = sum / nx;
      const vMean = sumV / nx;
      rowMeanU[j] = uMean;
      rowMeanV[j] = vMean;
      sumByLat[j] += uMean;
    }
    for (let j = 0; j < ny; j++) {
      const lat = 90 - j;
      const latRad = (lat * Math.PI) / 180;
      const cosLat = Math.cos(latRad);
      const dxMeters = Math.max(1e-6, 111_000 * cosLat);
      const invDx = 1 / dxMeters;
      const invDy = 1 / 111_000;
      const row = j * nx;
      const rowN = Math.max(0, j - 1) * nx;
      const rowS = Math.min(ny - 1, j + 1) * nx;
      const uBar = rowMeanU[j];
      const vBar = rowMeanV[j];
      let ekeSum = 0;
      let vortSqSum = 0;
      for (let i = 0; i < nx; i++) {
        const iE = (i + 1) % nx;
        const iW = (i - 1 + nx) % nx;
        const u0 = fixture.uData[row + i];
        const v0 = fixture.vData[row + i];
        const du = u0 - uBar;
        const dv = v0 - vBar;
        ekeSum += du * du + dv * dv;
        const dvDx = (fixture.vData[row + iE] - fixture.vData[row + iW]) * 0.5 * invDx;
        const duDy = (fixture.uData[rowS + i] - fixture.uData[rowN + i]) * 0.5 * invDy;
        const vort = dvDx - duDy;
        vortSqSum += vort * vort;
      }
      sumEkeByLat[j] += ekeSum / nx;
      sumVortRmsByLat[j] += Math.sqrt(vortSqSum / nx);
    }
  }

  const targetU = new Float64Array(ny);
  const targetEke = new Float64Array(ny);
  const targetVortRms = new Float64Array(ny);
  for (let j = 0; j < ny; j++) {
    targetU[j] = sumByLat[j] / files.length;
    targetEke[j] = sumEkeByLat[j] / files.length;
    targetVortRms[j] = sumVortRmsByLat[j] / files.length;
  }
  const latDeg = new Float64Array(ny);
  for (let j = 0; j < ny; j++) {
    latDeg[j] = 90 - j;
  }

  const output = `// Generated by npm run wind:targets; do not edit.\n\n` +
    `export const LAT_DEG = new Float32Array(${formatArray(latDeg)});\n` +
    `export const U10M_ZONAL_MEAN_TARGET = new Float32Array(${formatArray(targetU)});\n` +
    `export const EKE10M_BY_LAT_TARGET = new Float32Array(${formatArray(targetEke)});\n` +
    `export const VORT_RMS_BY_LAT_TARGET = new Float32Array(${formatArray(targetVortRms)});\n` +
    `export const SOURCE_FIXTURE_FILES = ${JSON.stringify(files)};\n` +
    `export const SOURCE_FIXTURE_COUNT = ${files.length};\n`;
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, output, 'utf8');
  console.log(`Wrote ${OUTPUT_PATH}`);
};

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
