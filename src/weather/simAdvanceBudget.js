export function clampSimAdvanceByTruthBudget(requestedSeconds, currentLeadSeconds, maxLeadSeconds) {
  if (!Number.isFinite(requestedSeconds) || requestedSeconds <= 0) return 0;
  if (!Number.isFinite(currentLeadSeconds) || currentLeadSeconds < 0) return requestedSeconds;
  if (!Number.isFinite(maxLeadSeconds) || maxLeadSeconds <= 0) return requestedSeconds;
  return Math.max(0, Math.min(requestedSeconds, maxLeadSeconds - currentLeadSeconds));
}
