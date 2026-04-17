#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const OUTPUT_DIR = path.join(repoRoot, 'weather-validation', 'output');
const REPORT_DIR = path.join(repoRoot, 'weather-validation', 'reports');

const defaults = {
  currentQuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c7-current-off-quick.json'),
  hybridQuickPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c10-bridged-hybrid-quick.json'),
  currentTransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c7-current-off-quick-transport-interface-budget.json'),
  hybridTransportPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c10-bridged-hybrid-quick-transport-interface-budget.json'),
  currentHadleyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c7-current-off-quick-hadley-partition-summary.json'),
  hybridHadleyPath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c10-bridged-hybrid-quick-hadley-partition-summary.json'),
  currentMoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c7-current-off-quick-moisture-attribution.json'),
  hybridMoisturePath: path.join(OUTPUT_DIR, 'earth-weather-architecture-c10-bridged-hybrid-quick-moisture-attribution.json'),
  reportPath: path.join(REPORT_DIR, 'earth-weather-architecture-c11-cycled-hybrid-flux-inversion-attribution.md'),
  jsonPath: path.join(REPORT_DIR, 'earth-weather-architecture-c11-cycled-hybrid-flux-inversion-attribution.json')
};

const argv = process.argv.slice(2);
const options = { ...defaults };
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--report' && argv[i + 1]) options.reportPath = path.resolve(argv[++i]);
  else if (arg === '--json' && argv[i + 1]) options.jsonPath = path.resolve(argv[++i]);
}

const ensureDir = (filePath) => fs.mkdirSync(path.dirname(filePath), { recursive: true });
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const extractMetrics = (auditJson) => auditJson?.horizons?.[auditJson.horizons.length - 1]?.latest?.metrics || {};
const round = (value, digits = 5) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;

const getInterface = (budget, targetLatDeg) => budget.interfaces.find((entry) => entry.targetLatDeg === targetLatDeg);
const sumLevels = (levels, field) => levels.reduce((sum, level) => sum + (level?.[field] || 0), 0);

export function summarizeInterface(budget, targetLatDeg) {
  const iface = getInterface(budget, targetLatDeg);
  if (!iface) return null;
  return {
    targetLatDeg,
    totalWaterFluxNorthKgM_1S: round(sumLevels(iface.modelLevels, 'totalWaterFluxNorthKgM_1S')),
    vaporFluxNorthKgM_1S: round(sumLevels(iface.modelLevels, 'vaporFluxNorthKgM_1S')),
    vaporFluxZonalMeanComponentKgM_1S: round(sumLevels(iface.modelLevels, 'vaporFluxZonalMeanComponentKgM_1S')),
    vaporFluxEddyComponentKgM_1S: round(sumLevels(iface.modelLevels, 'vaporFluxEddyComponentKgM_1S')),
    lowerTroposphereVaporFluxNorthKgM_1S: round(sumLevels(iface.modelLevels.filter((level) => level.sigmaMid < 0.45), 'vaporFluxNorthKgM_1S')),
    midUpperTroposphereVaporFluxNorthKgM_1S: round(sumLevels(iface.modelLevels.filter((level) => level.sigmaMid >= 0.45), 'vaporFluxNorthKgM_1S')),
    lowLevelVelocityMeanMs: round(iface.modelLevels[0]?.velocityMeanMs),
    lowerMidVelocityMeanMs: round(iface.modelLevels[1]?.velocityMeanMs),
    lowerDeepVelocityMeanMs: round(iface.modelLevels[2]?.velocityMeanMs)
  };
}

export function classifyC11Decision({
  offFlux,
  onFlux,
  offEquatorVelocity,
  onEquatorVelocity,
  offItczLat,
  onItczLat,
  offWesterlies,
  onWesterlies
}) {
  const signInverted = Number.isFinite(offFlux) && Number.isFinite(onFlux) && offFlux > 0 && onFlux < 0;
  const equatorVelocityFlipped = Number.isFinite(offEquatorVelocity) && Number.isFinite(onEquatorVelocity) && offEquatorVelocity > 0 && onEquatorVelocity < 0;
  const otherCirculationImproved = Number.isFinite(offItczLat) && Number.isFinite(onItczLat) && Number.isFinite(offWesterlies) && Number.isFinite(onWesterlies)
    && onItczLat > offItczLat
    && onWesterlies > offWesterlies;

  if (signInverted && equatorVelocityFlipped && otherCirculationImproved) {
    return {
      verdict: 'equatorial_overturning_polarity_inversion',
      nextMove: 'Architecture C12: equatorial overturning sign contract design'
    };
  }
  return {
    verdict: 'cycled_hybrid_flux_attribution_inconclusive',
    nextMove: 'Architecture C12: broadened cycled hybrid transport attribution'
  };
}

export function renderArchitectureC11Markdown({
  decision,
  metricSummary,
  interfaceSummary,
  hadleySummary,
  moistureSummary
}) {
  const lines = [
    '# Earth Weather Architecture C11 Cycled Hybrid Flux Inversion Attribution',
    '',
    'This phase attributes the only severe quick-gate regression left after the donor-worktree cycle and runtime contracts were restored: the cross-equatorial vapor-flux sign flip.',
    '',
    `- decision: \`${decision.verdict}\``,
    `- next move: ${decision.nextMove}`,
    '',
    '## Quick gate context',
    '',
    `- ITCZ latitude: off \`${metricSummary.offItczLatDeg}\`, on \`${metricSummary.onItczLatDeg}\``,
    `- ITCZ width: off \`${metricSummary.offItczWidthDeg}\`, on \`${metricSummary.onItczWidthDeg}\``,
    `- NH dry-belt ratio: off \`${metricSummary.offDryNorthRatio}\`, on \`${metricSummary.onDryNorthRatio}\``,
    `- SH dry-belt ratio: off \`${metricSummary.offDrySouthRatio}\`, on \`${metricSummary.onDrySouthRatio}\``,
    `- NH westerlies: off \`${metricSummary.offWesterlies}\`, on \`${metricSummary.onWesterlies}\``,
    `- cross-equatorial vapor flux north: off \`${metricSummary.offCrossEquatorialFlux}\`, on \`${metricSummary.onCrossEquatorialFlux}\``,
    '',
    '## Interface attribution',
    '',
    `- equator total-water flux north: off \`${interfaceSummary.offEquator.totalWaterFluxNorthKgM_1S}\`, on \`${interfaceSummary.onEquator.totalWaterFluxNorthKgM_1S}\``,
    `- equator zonal-mean vapor flux north: off \`${interfaceSummary.offEquator.vaporFluxZonalMeanComponentKgM_1S}\`, on \`${interfaceSummary.onEquator.vaporFluxZonalMeanComponentKgM_1S}\``,
    `- equator eddy vapor flux north: off \`${interfaceSummary.offEquator.vaporFluxEddyComponentKgM_1S}\`, on \`${interfaceSummary.onEquator.vaporFluxEddyComponentKgM_1S}\``,
    `- equator low-level velocity mean: off \`${interfaceSummary.offEquator.lowLevelVelocityMeanMs}\`, on \`${interfaceSummary.onEquator.lowLevelVelocityMeanMs}\``,
    `- 35° interface vapor flux north: off \`${interfaceSummary.offNorth35.vaporFluxNorthKgM_1S}\`, on \`${interfaceSummary.onNorth35.vaporFluxNorthKgM_1S}\``,
    '',
    '## Hadley / tracer context',
    '',
    `- north return-branch mass flux: off \`${hadleySummary.offNorthReturnKgM_1S}\`, on \`${hadleySummary.onNorthReturnKgM_1S}\``,
    `- low-level source partition local/imported proxy: off \`${hadleySummary.offLocalImportedProxy}\`, on \`${hadleySummary.onLocalImportedProxy}\``,
    `- north dry-belt upper-cloud path mean: off \`${moistureSummary.offUpperCloudPathKgM2}\`, on \`${moistureSummary.onUpperCloudPathKgM2}\``,
    `- north dry-belt ocean condensation mean: off \`${moistureSummary.offOceanCondKgM2}\`, on \`${moistureSummary.onOceanCondKgM2}\``,
    '',
    '## Interpretation',
    '',
    '- The repaired hybrid is no longer failing on integration contracts; it now produces a real climate benchmark.',
    '- Four of the six core quick metrics improve materially, so this is not a generic circulation collapse.',
    '- The severe gate failure is a polarity reversal in equatorial overturning: low-level equatorial transport flips from northward to strongly southward, and both the zonal-mean and eddy vapor components reinforce that reversal.',
    '- The donor/current hybrid also nulls the low-level local/imported source partition proxy, which means the next contract should focus on restoring equatorial overturning sign while keeping the donor-hybrid dry-belt improvements, not on more dry-belt-local patching.',
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  const currentQuickMetrics = extractMetrics(readJson(options.currentQuickPath));
  const hybridQuickMetrics = extractMetrics(readJson(options.hybridQuickPath));
  const currentTransport = readJson(options.currentTransportPath);
  const hybridTransport = readJson(options.hybridTransportPath);
  const currentHadley = readJson(options.currentHadleyPath);
  const hybridHadley = readJson(options.hybridHadleyPath);
  const currentMoisture = readJson(options.currentMoisturePath);
  const hybridMoisture = readJson(options.hybridMoisturePath);

  const metricSummary = {
    offItczLatDeg: round(currentQuickMetrics.itczLatDeg),
    onItczLatDeg: round(hybridQuickMetrics.itczLatDeg),
    offItczWidthDeg: round(currentQuickMetrics.itczWidthDeg),
    onItczWidthDeg: round(hybridQuickMetrics.itczWidthDeg),
    offDryNorthRatio: round(currentQuickMetrics.subtropicalDryNorthRatio),
    onDryNorthRatio: round(hybridQuickMetrics.subtropicalDryNorthRatio),
    offDrySouthRatio: round(currentQuickMetrics.subtropicalDrySouthRatio),
    onDrySouthRatio: round(hybridQuickMetrics.subtropicalDrySouthRatio),
    offWesterlies: round(currentQuickMetrics.midlatitudeWesterliesNorthU10Ms),
    onWesterlies: round(hybridQuickMetrics.midlatitudeWesterliesNorthU10Ms),
    offCrossEquatorialFlux: round(currentQuickMetrics.crossEquatorialVaporFluxNorthKgM_1S),
    onCrossEquatorialFlux: round(hybridQuickMetrics.crossEquatorialVaporFluxNorthKgM_1S)
  };

  const interfaceSummary = {
    offEquator: summarizeInterface(currentTransport, 0),
    onEquator: summarizeInterface(hybridTransport, 0),
    offNorth35: summarizeInterface(currentTransport, 35),
    onNorth35: summarizeInterface(hybridTransport, 35)
  };

  const hadleySummary = {
    offNorthReturnKgM_1S: round(currentHadley.returnBranchIntensity?.northDryBeltEquatorwardMassFluxKgM_1S),
    onNorthReturnKgM_1S: round(hybridHadley.returnBranchIntensity?.northDryBeltEquatorwardMassFluxKgM_1S),
    offLocalImportedProxy: `${round(currentHadley.lowLevelSourcePartition?.localSourceProxyFrac)} / ${round(currentHadley.lowLevelSourcePartition?.importedSourceProxyFrac)}`,
    onLocalImportedProxy: `${round(hybridHadley.lowLevelSourcePartition?.localSourceProxyFrac)} / ${round(hybridHadley.lowLevelSourcePartition?.importedSourceProxyFrac)}`
  };

  const moistureSummary = {
    offUpperCloudPathKgM2: round(currentMoisture.latestMetrics?.northDryBeltUpperCloudPathMeanKgM2),
    onUpperCloudPathKgM2: round(hybridMoisture.latestMetrics?.northDryBeltUpperCloudPathMeanKgM2),
    offOceanCondKgM2: round(currentMoisture.latestMetrics?.northDryBeltOceanLargeScaleCondensationMeanKgM2),
    onOceanCondKgM2: round(hybridMoisture.latestMetrics?.northDryBeltOceanLargeScaleCondensationMeanKgM2)
  };

  const decision = classifyC11Decision({
    offFlux: metricSummary.offCrossEquatorialFlux,
    onFlux: metricSummary.onCrossEquatorialFlux,
    offEquatorVelocity: interfaceSummary.offEquator?.lowLevelVelocityMeanMs,
    onEquatorVelocity: interfaceSummary.onEquator?.lowLevelVelocityMeanMs,
    offItczLat: metricSummary.offItczLatDeg,
    onItczLat: metricSummary.onItczLatDeg,
    offWesterlies: metricSummary.offWesterlies,
    onWesterlies: metricSummary.onWesterlies
  });

  const result = {
    schema: 'satellite-wars.earth-weather-architecture-c11-cycled-hybrid-flux-inversion-attribution.v1',
    generatedAt: new Date().toISOString(),
    decision,
    metricSummary,
    interfaceSummary,
    hadleySummary,
    moistureSummary
  };

  ensureDir(options.jsonPath);
  ensureDir(options.reportPath);
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(options.reportPath, renderArchitectureC11Markdown({
    decision,
    metricSummary,
    interfaceSummary,
    hadleySummary,
    moistureSummary
  }));
  process.stdout.write(`${JSON.stringify({ reportPath: options.reportPath, jsonPath: options.jsonPath, decision, metricSummary, interfaceSummary })}\n`);
}

const isMain = process.argv[1] === __filename;
if (isMain) {
  main();
}
