export const normalizeObservationTarget = (rawUrl) => {
  const next = new URL(rawUrl);
  if (!next.searchParams.get('mode')) {
    next.searchParams.set('mode', 'solo');
  }
  return next;
};

export const flattenTabs = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  for (const key of ['tabs', 'targets', 'items', 'data']) {
    if (Array.isArray(value[key])) return value[key];
  }
  return [];
};

export const tabIdOf = (tab) => tab?.id ?? tab?.targetId ?? tab?.tabId ?? tab?.target?.id ?? null;
export const tabUrlOf = (tab) => tab?.url ?? tab?.targetUrl ?? tab?.pageUrl ?? tab?.target?.url ?? null;
export const tabTitleOf = (tab) => tab?.title ?? tab?.target?.title ?? null;
export const tabFocused = (tab) => Boolean(tab?.focused ?? tab?.active ?? tab?.selected ?? tab?.current);

export const scoreTab = (tab, normalizedTarget) => {
  const rawUrl = tabUrlOf(tab);
  if (!rawUrl) return -Infinity;
  let url;
  try {
    url = new URL(rawUrl);
  } catch (_) {
    return -Infinity;
  }
  let score = 0;
  if (url.href === normalizedTarget.href) score += 100;
  if (url.origin === normalizedTarget.origin) score += 50;
  if (url.pathname === normalizedTarget.pathname) score += 10;
  if (url.searchParams.get('mode') === normalizedTarget.searchParams.get('mode')) score += 10;
  if (tabFocused(tab)) score += 5;
  if ((tabTitleOf(tab) || '').toLowerCase().includes('satellite')) score += 2;
  return score;
};

export const sortTabsForTarget = (tabs, normalizedTarget) => [...tabs].sort((a, b) => scoreTab(b, normalizedTarget) - scoreTab(a, normalizedTarget));

export const selectMatchingTabs = (tabs, normalizedTarget) => sortTabsForTarget(tabs, normalizedTarget)
  .filter((tab) => scoreTab(tab, normalizedTarget) > 0 && tabIdOf(tab));

const TRANSIENT_BROWSER_ERROR_PATTERNS = [
  /gateway timeout/i,
  /browser unavailable/i,
  /target closed/i,
  /websocket/i,
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
  /EPIPE/i,
  /socket hang up/i,
  /context canceled/i,
  /No tab target/i,
  /not found/i
];

export const isTransientBrowserError = (message) => {
  if (!message || typeof message !== 'string') return false;
  return TRANSIENT_BROWSER_ERROR_PATTERNS.some((pattern) => pattern.test(message));
};

export const parseSimTimeLabel = (label) => {
  if (typeof label !== 'string') return null;
  const match = label.trim().match(/^Day\s+(\d+)\s*,\s*(\d{1,2}):(\d{2})$/i);
  if (!match) return null;
  const [, dayText, hourText, minuteText] = match;
  const day = Number.parseInt(dayText, 10);
  const hour = Number.parseInt(hourText, 10);
  const minute = Number.parseInt(minuteText, 10);
  if (![day, hour, minute].every(Number.isFinite)) return null;
  return day * 86400 + hour * 3600 + minute * 60;
};

const targetModeScore = (url, preferredMode) => {
  if (!preferredMode) return 0;
  return url.searchParams.get('mode') === preferredMode ? 20 : 0;
};

export const scoreDevtoolsPageTarget = (entry, { targetUrl, preferredMode = 'solo' } = {}) => {
  if (!entry || entry.type !== 'page' || !entry.url) return -Infinity;
  let url;
  let preferred;
  try {
    url = new URL(entry.url);
    preferred = targetUrl ? new URL(targetUrl) : null;
  } catch (_) {
    return -Infinity;
  }
  let score = 0;
  if (preferred && url.href === preferred.href) score += 100;
  if (preferred && url.origin === preferred.origin) score += 50;
  if (preferred && url.pathname === preferred.pathname) score += 10;
  score += targetModeScore(url, preferredMode);
  if ((entry.title || '').toLowerCase().includes('satellite')) score += 5;
  if (entry.webSocketDebuggerUrl) score += 5;
  return score;
};

export const selectDevtoolsPageTarget = (targets, options = {}) => {
  if (!Array.isArray(targets)) return null;
  return [...targets]
    .filter((entry) => entry?.type === 'page' && entry?.url)
    .sort((a, b) => scoreDevtoolsPageTarget(b, options) - scoreDevtoolsPageTarget(a, options))[0] ?? null;
};
