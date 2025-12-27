const DEFAULT_BASE_URL = '/__weatherlog';
const DEFAULT_FLUSH_INTERVAL_MS = 300;

export class WeatherLogSink {
  constructor({ baseUrl = DEFAULT_BASE_URL, flushIntervalMs = DEFAULT_FLUSH_INTERVAL_MS } = {}) {
    this.baseUrl = baseUrl;
    this.flushIntervalMs = flushIntervalMs;
    this._queue = [];
    this._flushTimer = null;
    this._flushing = false;
    this._disabled = false;
    this._warned = false;
    this._session = null;
    this._ready = false;
    this._initPromise = null;
  }

  async init() {
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._fetchSession();
    return this._initPromise;
  }

  getSession() {
    return this._session;
  }

  isReady() {
    return this._ready;
  }

  isDisabled() {
    return this._disabled;
  }

  enqueue(line) {
    if (this._disabled || !this._ready) return;
    if (typeof line !== 'string' || line.length === 0) return;
    this._queue.push(line);
    this._scheduleFlush();
  }

  async _fetchSession() {
    if (this._disabled) return null;
    try {
      const res = await fetch(`${this.baseUrl}/session`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`session status ${res.status}`);
      const session = await res.json();
      if (!session || !session.runId) throw new Error('invalid session');
      this._session = session;
      this._ready = true;
      return session;
    } catch (err) {
      this._disableOnce(`Weather log sink disabled: ${err?.message || err}`);
      return null;
    }
  }

  _scheduleFlush() {
    if (this._flushTimer || this._flushing || this._disabled) return;
    this._flushTimer = setTimeout(() => {
      this._flushTimer = null;
      this._flush();
    }, this.flushIntervalMs);
  }

  async _flush() {
    if (this._disabled || this._flushing) return;
    if (this._queue.length === 0) return;
    this._flushing = true;
    const batch = this._queue.splice(0, this._queue.length);
    const body = `${batch.join('\n')}\n`;
    try {
      const res = await fetch(`${this.baseUrl}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-ndjson' },
        body
      });
      if (!res.ok) throw new Error(`log status ${res.status}`);
    } catch (err) {
      this._disableOnce(`Weather log sink disabled: ${err?.message || err}`);
    } finally {
      this._flushing = false;
    }
    if (this._queue.length > 0) {
      this._scheduleFlush();
    }
  }

  _disableOnce(message) {
    if (this._disabled) return;
    this._disabled = true;
    this._queue.length = 0;
    if (!this._warned && typeof console !== 'undefined') {
      console.warn(message);
      this._warned = true;
    }
  }
}

export const createWeatherLogSink = (options) => new WeatherLogSink(options);
