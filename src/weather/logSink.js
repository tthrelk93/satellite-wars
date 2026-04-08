const DEFAULT_BASE_URL = '/__weatherlog';
const DEFAULT_FLUSH_INTERVAL_MS = 300;
const DEFAULT_RETRY_DELAY_MS = 1000;
const DEFAULT_MAX_RETRY_DELAY_MS = 15000;

export class WeatherLogSink {
  constructor({
    baseUrl = DEFAULT_BASE_URL,
    flushIntervalMs = DEFAULT_FLUSH_INTERVAL_MS,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    maxRetryDelayMs = DEFAULT_MAX_RETRY_DELAY_MS
  } = {}) {
    this.baseUrl = baseUrl;
    this.flushIntervalMs = flushIntervalMs;
    this.retryDelayMs = retryDelayMs;
    this.maxRetryDelayMs = Math.max(maxRetryDelayMs, retryDelayMs);
    this._queue = [];
    this._flushTimer = null;
    this._flushing = false;
    this._disabled = false;
    this._session = null;
    this._ready = false;
    this._initPromise = null;
    this._retryTimer = null;
    this._nextRetryDelayMs = this.retryDelayMs;
    this._lastWarningMessage = null;
  }

  async init() {
    if (this._disabled) return null;
    if (this._ready) return this._session;
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._fetchSession().finally(() => {
      this._initPromise = null;
    });
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
    if (this._disabled || this._ready) return this._session;
    try {
      const res = await fetch(`${this.baseUrl}/session`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`session status ${res.status}`);
      const session = await res.json();
      if (!session || !session.runId) throw new Error('invalid session');
      this._session = session;
      this._ready = true;
      this._nextRetryDelayMs = this.retryDelayMs;
      this._clearRetryTimer();
      if (this._queue.length > 0) {
        this._scheduleFlush();
      }
      return session;
    } catch (err) {
      this._ready = false;
      this._session = null;
      this._warnRetryable(`Weather log sink waiting for session: ${err?.message || err}`);
      this._scheduleRetry();
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
    if (!this._ready) {
      this._scheduleRetry();
      void this.init();
      return;
    }
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
      this._ready = false;
      this._session = null;
      this._queue.unshift(...batch);
      this._warnRetryable(`Weather log sink retrying after log failure: ${err?.message || err}`);
      this._scheduleRetry();
    } finally {
      this._flushing = false;
    }
    if (this._queue.length > 0) {
      this._scheduleFlush();
    }
  }

  _scheduleRetry() {
    if (this._disabled || this._ready || this._retryTimer) return;
    const delayMs = this._nextRetryDelayMs;
    this._nextRetryDelayMs = Math.min(this.maxRetryDelayMs, Math.max(this.retryDelayMs, delayMs * 2));
    this._retryTimer = setTimeout(() => {
      this._retryTimer = null;
      void this.init();
    }, delayMs);
  }

  _clearRetryTimer() {
    if (!this._retryTimer) return;
    clearTimeout(this._retryTimer);
    this._retryTimer = null;
  }

  _warnRetryable(message) {
    if (typeof console === 'undefined' || message === this._lastWarningMessage) return;
    this._lastWarningMessage = message;
    console.warn(message);
  }

  _disableOnce(message) {
    if (this._disabled) return;
    this._disabled = true;
    this._queue.length = 0;
    this._clearRetryTimer();
    if (typeof console !== 'undefined') {
      console.warn(message);
    }
  }
}

export const createWeatherLogSink = (options) => new WeatherLogSink(options);
