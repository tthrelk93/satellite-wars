export const PARTICLE_EVOLVE_PHASE_KEYS = [
  'clearBucketsMs',
  'respawnMs',
  'sample0Ms',
  'sample1Ms',
  'projectValidateMs',
  'bucketStageMs'
];

export const createParticleEvolvePhaseTotals = () => ({
  clearBucketsMs: 0,
  respawnMs: 0,
  sample0Ms: 0,
  sample1Ms: 0,
  projectValidateMs: 0,
  bucketStageMs: 0
});

export const addParticleEvolvePhase = (totals, key, deltaMs) => {
  if (!totals || !PARTICLE_EVOLVE_PHASE_KEYS.includes(key)) return totals;
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return totals;
  totals[key] += deltaMs;
  return totals;
};

export const mergeParticleEvolvePhaseTotals = (base, extra) => {
  const merged = createParticleEvolvePhaseTotals();
  for (const key of PARTICLE_EVOLVE_PHASE_KEYS) {
    const baseValue = Number.isFinite(base?.[key]) ? base[key] : 0;
    const extraValue = Number.isFinite(extra?.[key]) ? extra[key] : 0;
    merged[key] = baseValue + extraValue;
  }
  return merged;
};

export const hasParticleEvolvePhaseData = (phases) => PARTICLE_EVOLVE_PHASE_KEYS
  .some((key) => Number.isFinite(phases?.[key]) && phases[key] > 0);

export const dominantParticleEvolvePhase = (phases) => {
  if (!hasParticleEvolvePhaseData(phases)) return null;
  const candidates = PARTICLE_EVOLVE_PHASE_KEYS
    .map((key) => [key, Number.isFinite(phases?.[key]) ? phases[key] : 0])
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);
  return candidates[0]?.[0] ?? null;
};
