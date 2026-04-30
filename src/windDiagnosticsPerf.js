export const createWindDiagnosticsPerfPayload = ({ modelDue, referenceDue, vizDue, windStreamlinesVisible }) => ({
  due: {
    model: Boolean(modelDue),
    reference: Boolean(referenceDue),
    viz: Boolean(vizDue)
  },
  windStreamlinesVisible: Boolean(windStreamlinesVisible),
  phases: {
    model: { ms: null, updated: false },
    reference: { ms: null, updated: false },
    viz: { ms: null, updated: false },
    targets: { ms: null, updated: false },
    referenceComparison: { ms: null, updated: false }
  },
  anyUpdated: false
});

export const measureWindDiagnosticsPhase = (payload, phaseKey, fn, nowFn = () => performance.now()) => {
  const start = nowFn();
  const updated = Boolean(fn());
  const end = nowFn();
  payload.phases[phaseKey] = {
    ms: Math.max(0, end - start),
    updated
  };
  if (updated) payload.anyUpdated = true;
  return updated;
};
