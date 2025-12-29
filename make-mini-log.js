const fs = require('fs');
const path = require('path');
const readline = require('readline');

const LOG_DIR = path.join(process.cwd(), 'logs');
const CHUNK_SIZE = 25;

const isLogFile = (name) => name.endsWith('.jsonl') && !name.endsWith('-mini.jsonl');

const getNewestLogFile = async () => {
  const entries = await fs.promises.readdir(LOG_DIR, { withFileTypes: true });
  let newest = null;
  let newestTime = -Infinity;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!isLogFile(entry.name)) continue;
    const fullPath = path.join(LOG_DIR, entry.name);
    const stats = await fs.promises.stat(fullPath);
    const mtime = stats.mtimeMs;
    if (mtime > newestTime) {
      newestTime = mtime;
      newest = fullPath;
    }
  }
  return newest;
};

const countLines = (filePath) =>
  new Promise((resolve, reject) => {
    let count = 0;
    const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    rl.on('line', () => {
      count += 1;
    });
    rl.on('close', () => resolve(count));
    rl.on('error', reject);
    stream.on('error', reject);
  });

const buildRanges = (total, size) => {
  if (!total || total <= 0) return [];
  const startEnd = Math.min(total - 1, size - 1);
  const midStart = Math.max(0, Math.floor(total / 2) - Math.floor(size / 2));
  const midEnd = Math.min(total - 1, midStart + size - 1);
  const endStart = Math.max(0, total - size);
  const endEnd = total - 1;
  return [
    { start: 0, end: startEnd },
    { start: midStart, end: midEnd },
    { start: endStart, end: endEnd }
  ];
};

const indexInRanges = (idx, ranges) => {
  for (const range of ranges) {
    if (idx >= range.start && idx <= range.end) return true;
  }
  return false;
};

const writeMiniLog = (sourcePath, totalLines) =>
  new Promise((resolve, reject) => {
    const ranges = buildRanges(totalLines, CHUNK_SIZE);
    const baseName = path.basename(sourcePath, '.jsonl');
    const miniName = `${baseName}-mini.jsonl`;
    const outputPath = path.join(LOG_DIR, miniName);

    const input = fs.createReadStream(sourcePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input, crlfDelay: Infinity });
    const output = fs.createWriteStream(outputPath, { encoding: 'utf8' });
    let index = 0;
    let written = 0;

    rl.on('line', (line) => {
      if (indexInRanges(index, ranges)) {
        output.write(`${line}\n`);
        written += 1;
      }
      index += 1;
    });
    rl.on('close', () => {
      output.end(() => resolve({ outputPath, written, totalLines }));
    });
    rl.on('error', reject);
    input.on('error', reject);
    output.on('error', reject);
  });

const main = async () => {
  try {
    const newest = await getNewestLogFile();
    if (!newest) {
      console.error(`No .jsonl logs found in ${LOG_DIR}`);
      process.exit(1);
    }
    const totalLines = await countLines(newest);
    const result = await writeMiniLog(newest, totalLines);
    console.log(`Source: ${path.relative(process.cwd(), newest)}`);
    console.log(`Lines: ${result.totalLines}`);
    console.log(`Mini: ${path.relative(process.cwd(), result.outputPath)}`);
    console.log(`Mini lines: ${result.written}`);
  } catch (err) {
    console.error(`Failed to create mini log: ${err?.message || err}`);
    process.exit(1);
  }
};

main();
