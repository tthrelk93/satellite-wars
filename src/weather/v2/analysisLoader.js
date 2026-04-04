const DEFAULT_MANIFEST_URL = `${process.env.PUBLIC_URL || ''}/analysis/manifest.json`;

const resolveRelativeUrl = (baseUrl, relativePath) => {
  if (!relativePath) return null;
  try {
    return new URL(relativePath, typeof window !== 'undefined' ? window.location.href : baseUrl).toString();
  } catch {
    if (relativePath.startsWith('/')) return relativePath;
    const base = baseUrl.replace(/[^/]+$/, '');
    return `${base}${relativePath}`;
  }
};

export async function loadAnalysisDataset({ manifestUrl = DEFAULT_MANIFEST_URL, caseId, fetchImpl } = {}) {
  const fetchFn = fetchImpl || (typeof fetch !== 'undefined' ? (...args) => fetch(...args) : null);
  if (!fetchFn) return null;

  let manifest;
  try {
    const response = await fetchFn(manifestUrl);
    if (!response.ok) return null;
    manifest = await response.json();
  } catch {
    return null;
  }

  const cases = Array.isArray(manifest?.cases) ? manifest.cases : [];
  if (!cases.length) return null;
  const selected = caseId
    ? cases.find((entry) => entry.caseId === caseId)
    : cases.find((entry) => entry.caseId === manifest.defaultCaseId) || cases[0];
  if (!selected?.path) return null;

  try {
    const response = await fetchFn(resolveRelativeUrl(manifestUrl, selected.path));
    if (!response.ok) return null;
    const dataset = await response.json();
    return {
      ...dataset,
      caseId: dataset.caseId || selected.caseId,
      manifestUrl,
      sourcePath: selected.path,
      description: selected.description || dataset.description || null
    };
  } catch {
    return null;
  }
}
