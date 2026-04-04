const fmt = (value, digits = 2) => (Number.isFinite(value) ? value.toFixed(digits) : 'n/a');

function renderPrecipTable(precip) {
  const rows = (precip?.categorical || []).map((entry) => `| ${fmt(entry.thresholdMmHr, 1)} | ${entry.hits} | ${entry.misses} | ${entry.falseAlarms} | ${fmt(entry.frequencyBias, 3)} | ${fmt(entry.pod, 3)} | ${fmt(entry.far, 3)} | ${fmt(entry.csi, 3)} |`);
  if (!rows.length) return '_No categorical precip metrics available._';
  return [
    '| Threshold (mm/hr) | Hits | Misses | False alarms | Frequency bias | POD | FAR | CSI |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows
  ].join('\n');
}

export function renderValidationMarkdown({ manifest, summary, leadResults, cycloneTrack }) {
  const lines = [
    `# Weather validation summary: ${manifest.caseId}`,
    '',
    `- Init time: ${manifest.initTime}`,
    `- Leads (hours): ${manifest.leadHours.join(', ')}`,
    `- Output JSON: ${summary.outputJsonPath}`,
    '',
    '## Aggregate metrics',
    '',
    `- SLP RMSE mean: ${fmt(summary.aggregate.slpRmseHpaMean, 3)} hPa`,
    `- 500 hPa height RMSE mean: ${fmt(summary.aggregate.z500RmseMMean, 3)} m`,
    `- 10 m wind RMSE mean: ${fmt(summary.aggregate.wind10RmseMsMean, 3)} m/s`,
    `- Total column water RMSE mean: ${fmt(summary.aggregate.totalColumnWaterRmseKgM2Mean, 3)} kg/m²`,
    `- Precip bias mean: ${fmt(summary.aggregate.precipBiasMmHrMean, 3)} mm/hr`,
    `- Total cloud bias mean: ${fmt(summary.aggregate.cloudTotalBiasMean, 4)}`,
    ''
  ];

  if (cycloneTrack) {
    lines.push('## Cyclone track error');
    lines.push('');
    lines.push(`- Mean error: ${fmt(cycloneTrack.meanErrorKm, 2)} km`);
    lines.push(`- Max error: ${fmt(cycloneTrack.maxErrorKm, 2)} km`);
    lines.push('');
  }

  leadResults.forEach((lead) => {
    const metrics = lead.metrics;
    lines.push(`## Lead +${lead.leadHours}h`);
    lines.push('');
    lines.push(`- SLP RMSE: ${fmt(metrics.slpRmseHpa, 3)} hPa`);
    lines.push(`- 500 hPa height RMSE: ${fmt(metrics.z500RmseM, 3)} m`);
    lines.push(`- 10 m wind RMSE: ${fmt(metrics.wind10RmseMs, 3)} m/s`);
    lines.push(`- Total column water RMSE: ${fmt(metrics.totalColumnWaterRmseKgM2, 3)} kg/m²`);
    lines.push(`- Precip bias: ${fmt(metrics.precip.biasMmHr, 3)} mm/hr`);
    lines.push(`- Cloud bias (low/high/total): ${fmt(metrics.cloudFractionBias.low, 4)} / ${fmt(metrics.cloudFractionBias.high, 4)} / ${fmt(metrics.cloudFractionBias.total, 4)}`);
    lines.push('');
    lines.push(renderPrecipTable(metrics.precip));
    lines.push('');
  });

  return `${lines.join('\n')}\n`;
}
