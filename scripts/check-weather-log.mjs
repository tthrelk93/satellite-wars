import fs from 'fs';
import readline from 'readline';

const USAGE = 'Usage: node scripts/check-weather-log.mjs <log.jsonl> [--all] [--segment=N]';

const args = process.argv.slice(2);
let filePath = null;
let checkAll = false;
let segmentIndex = null;

for (const arg of args) {
  if (arg === '--all') {
    checkAll = true;
  } else if (arg.startsWith('--segment=')) {
    const raw = Number.parseInt(arg.split('=')[1], 10);
    if (Number.isFinite(raw)) segmentIndex = raw;
  } else if (!filePath) {
    filePath = arg;
  }
}

if (!filePath) {
  console.error(USAGE);
  process.exit(1);
}

const formatNumber = (value) => {
  if (!Number.isFinite(value)) return 'null';
  const abs = Math.abs(value);
  if (abs >= 1000 || (abs > 0 && abs < 0.01)) return value.toExponential(3);
  return value.toFixed(3);
};

const makeWarningTracker = () => ({
  count: 0,
  first: null,
  streak: 0,
  maxStreak: 0
});

const updateWarning = (tracker, isHit, sim) => {
  if (isHit) {
    tracker.count += 1;
    tracker.streak += 1;
    if (!tracker.first) tracker.first = sim;
    tracker.maxStreak = Math.max(tracker.maxStreak, tracker.streak);
  } else {
    tracker.streak = 0;
  }
};

const makeSegment = (index, runStart) => ({
  index,
  runStart,
  runId: runStart?.runId ?? null,
  seqStart: runStart?.seq ?? null,
  gridCount: runStart?.model?.grid?.nx && runStart?.model?.grid?.ny
    ? runStart.model.grid.nx * runStart.model.grid.ny
    : null,
  dynParams: runStart?.params?.dyn ?? null,
  massParams: runStart?.params?.mass ?? null,
  psMeanHpa0: null,
  stateCount: 0,
  firstFail: null,
  gateFirst: {},
  missingKeys: new Set(),
  warnings: {
    windPegged: makeWarningTracker(),
    psMin: makeWarningTracker(),
    psAtMaxAreaFrac: makeWarningTracker(),
    psAtMaxCount: makeWarningTracker()
  }
});

const addMissing = (seg, key) => {
  seg.missingKeys.add(key);
};

const checkGate = (seg, entry) => {
  const fields = entry.fields || {};
  const clamps = entry.clamps || {};
  const sim = entry.sim || {};
  const failReasons = [];

  const psMeanHpa = fields.ps?.meanHpa;
  if (!Number.isFinite(seg.psMeanHpa0) && Number.isFinite(psMeanHpa)) {
    seg.psMeanHpa0 = psMeanHpa;
  }

  const tuMax = fields.TU?.max;
  if (Number.isFinite(tuMax)) {
    if (tuMax >= 350) failReasons.push({ key: 'fields.TU.max', value: tuMax, limit: 350, op: '>=' });
  } else {
    addMissing(seg, 'fields.TU.max');
  }

  const tMax = fields.T?.max;
  if (Number.isFinite(tMax)) {
    if (tMax >= 330) failReasons.push({ key: 'fields.T.max', value: tMax, limit: 330, op: '>=' });
  } else {
    addMissing(seg, 'fields.T.max');
  }

  const qvUMax = fields.qvU?.max;
  if (Number.isFinite(qvUMax)) {
    if (qvUMax >= 0.05) failReasons.push({ key: 'fields.qvU.max', value: qvUMax, limit: 0.05, op: '>=' });
  } else {
    addMissing(seg, 'fields.qvU.max');
  }

  const rhuP95 = fields.RHU?.p95;
  if (Number.isFinite(rhuP95)) {
    if (rhuP95 >= 1.2) failReasons.push({ key: 'fields.RHU.p95', value: rhuP95, limit: 1.2, op: '>=' });
  } else {
    addMissing(seg, 'fields.RHU.p95');
  }

  const tauLowClamp = clamps.tauLowClampCount;
  const tauHighClamp = clamps.tauHighClampCount;
  if (Number.isFinite(tauLowClamp) && Number.isFinite(tauHighClamp) && seg.gridCount) {
    const ratioLow = tauLowClamp / seg.gridCount;
    const ratioHigh = tauHighClamp / seg.gridCount;
    if (ratioLow >= 0.01) {
      failReasons.push({ key: 'clamps.tauLowClampCount', value: ratioLow, limit: 0.01, op: '>=' });
    }
    if (ratioHigh >= 0.01) {
      failReasons.push({ key: 'clamps.tauHighClampCount', value: ratioHigh, limit: 0.01, op: '>=' });
    }
  } else {
    if (!Number.isFinite(tauLowClamp)) addMissing(seg, 'clamps.tauLowClampCount');
    if (!Number.isFinite(tauHighClamp)) addMissing(seg, 'clamps.tauHighClampCount');
    if (!seg.gridCount) addMissing(seg, 'model.grid.nx/ny');
  }

  const sanity = entry.sanity || {};
  const simDay = Number.isFinite(sim.simDay) ? sim.simDay : null;
  if (simDay != null && simDay >= 5) {
    const psRms = fields.ps?.rmsVsClimoHpa;
    const rmsOk = Number.isFinite(psRms) ? psRms <= 20 : null;
    const drift = Number.isFinite(seg.psMeanHpa0) && Number.isFinite(psMeanHpa)
      ? Math.abs(psMeanHpa - seg.psMeanHpa0)
      : null;
    const driftOk = drift != null ? drift <= 2 : null;

    if (driftOk === false && rmsOk !== true) {
      failReasons.push({
        key: 'fields.ps.meanHpa drift',
        value: drift,
        limit: 2,
        op: '> after day 5'
      });
    } else if (driftOk === null && rmsOk === false) {
      failReasons.push({
        key: 'fields.ps.rmsVsClimoHpa',
        value: psRms,
        limit: 20,
        op: '> after day 5'
      });
    } else if (driftOk === null && rmsOk === null) {
      if (!Number.isFinite(seg.psMeanHpa0)) addMissing(seg, 'fields.ps.meanHpa (baseline)');
      if (!Number.isFinite(psMeanHpa)) addMissing(seg, 'fields.ps.meanHpa');
      addMissing(seg, 'fields.ps.rmsVsClimoHpa');
    }
  }

  const windP95 = fields.wind?.p95;
  const maxWind = seg.dynParams?.maxWind;
  updateWarning(seg.warnings.windPegged, Number.isFinite(windP95) && Number.isFinite(maxWind)
    ? windP95 > 0.9 * maxWind
    : false, sim);

  const psMin = fields.ps?.min;
  const psMinLimit = seg.massParams?.psMin;
  updateWarning(seg.warnings.psMin, Number.isFinite(psMin) && Number.isFinite(psMinLimit)
    ? psMin <= psMinLimit + 1e-6
    : false, sim);

  const psAtMaxAreaFrac = sanity.psAtMaxAreaFrac;
  updateWarning(seg.warnings.psAtMaxAreaFrac, Number.isFinite(psAtMaxAreaFrac)
    ? psAtMaxAreaFrac >= 0.002
    : false, sim);
  const psAtMaxCount = sanity.psAtMaxCount;
  updateWarning(seg.warnings.psAtMaxCount, Number.isFinite(psAtMaxCount) && seg.gridCount
    ? psAtMaxCount / seg.gridCount >= 0.01
    : false, sim);

  if (failReasons.length) {
    for (const reason of failReasons) {
      if (!seg.gateFirst[reason.key]) {
        seg.gateFirst[reason.key] = {
          simTimeSeconds: sim.simTimeSeconds ?? null,
          simDay: sim.simDay ?? null,
          todHours: sim.todHours ?? null,
          value: reason.value,
          limit: reason.limit,
          op: reason.op
        };
      }
    }
  }

  if (!seg.firstFail && failReasons.length) {
    seg.firstFail = {
      simTimeSeconds: sim.simTimeSeconds ?? null,
      simDay: sim.simDay ?? null,
      todHours: sim.todHours ?? null,
      reasons: failReasons
    };
  }
};

const reportWarning = (label, tracker) => {
  if (!tracker.first) return null;
  const long = tracker.maxStreak >= 3 || tracker.count >= 5;
  return {
    label,
    count: tracker.count,
    maxStreak: tracker.maxStreak,
    long,
    first: tracker.first
  };
};

const reportSegment = (seg) => {
  const header = `Segment ${seg.index}${seg.runId ? ` (runId=${seg.runId})` : ''}`;
  console.log(header);
  console.log(`  states=${seg.stateCount} seqStart=${seg.seqStart ?? 'null'}`);
  if (!seg.stateCount) {
    console.log('  STATUS: NO STATE DATA');
    return;
  }
  if (seg.firstFail) {
    const { simTimeSeconds, simDay, todHours, reasons } = seg.firstFail;
    console.log(`  STATUS: FAIL at t=${formatNumber(simTimeSeconds)}s day=${simDay ?? 'null'} tod=${formatNumber(todHours)}h`);
    for (const reason of reasons) {
      console.log(`    - ${reason.key} ${reason.op} ${reason.limit} (value=${formatNumber(reason.value)})`);
    }
  } else {
    console.log('  STATUS: PASS');
  }
  const warnItems = [
    reportWarning('wind pegged', seg.warnings.windPegged),
    reportWarning('ps min at psMin', seg.warnings.psMin),
    reportWarning('ps at max area>=0.2%', seg.warnings.psAtMaxAreaFrac),
    reportWarning('ps at max cells>=1%', seg.warnings.psAtMaxCount)
  ].filter(Boolean);
  if (warnItems.length) {
    console.log('  WARN: likely unstable indicators');
    for (const warn of warnItems) {
      const sim = warn.first;
      const simTime = sim?.simTimeSeconds ?? null;
      const simDay = sim?.simDay ?? null;
      const longTag = warn.long ? 'LONG' : 'brief';
      console.log(
        `    - ${warn.label}: count=${warn.count} maxStreak=${warn.maxStreak} ${longTag} first t=${formatNumber(simTime)}s day=${simDay ?? 'null'}`
      );
    }
  }
  const gateKeys = Object.keys(seg.gateFirst);
  if (gateKeys.length) {
    console.log('  Gate first failures:');
    for (const key of gateKeys) {
      const entry = seg.gateFirst[key];
      console.log(
        `    - ${key} ${entry.op} ${entry.limit} first at t=${formatNumber(entry.simTimeSeconds)}s day=${entry.simDay ?? 'null'} value=${formatNumber(entry.value)}`
      );
    }
  }
  if (seg.missingKeys.size) {
    console.log(`  MISSING: ${Array.from(seg.missingKeys).join(', ')}`);
  }
};

const segments = [];
let current = null;
let segmentCounter = 0;
let parseErrors = 0;

const startSegment = (runStart) => {
  if (current) segments.push(current);
  current = makeSegment(segmentCounter++, runStart);
};

const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

for await (const line of rl) {
  const trimmed = line.trim();
  if (!trimmed) continue;
  let entry = null;
  try {
    entry = JSON.parse(trimmed);
  } catch (_) {
    parseErrors += 1;
    continue;
  }
  if (entry.event === 'runStart') {
    startSegment(entry);
    continue;
  }
  if (entry.event === 'state') {
    if (!current) startSegment(null);
    current.stateCount += 1;
    checkGate(current, entry);
  }
}
if (current) segments.push(current);

if (!segments.length) {
  console.log('No segments found in log.');
  process.exit(1);
}

console.log(`Log: ${filePath}`);
console.log(`Segments found: ${segments.length}${parseErrors ? ` (parse errors: ${parseErrors})` : ''}`);

let toReport = segments;
if (!checkAll && segmentIndex == null) {
  toReport = [segments[segments.length - 1]];
  console.log('Defaulting to last segment. Use --all or --segment=N to check others.');
} else if (segmentIndex != null) {
  toReport = segments.filter((seg) => seg.index === segmentIndex);
  if (!toReport.length) {
    console.log(`Segment ${segmentIndex} not found.`);
    process.exit(1);
  }
}

for (const seg of toReport) {
  reportSegment(seg);
}
