import { WeatherLogSink } from './logSink';

const waitFor = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('WeatherLogSink', () => {
  const originalFetch = global.fetch;
  const originalWarn = console.warn;

  beforeEach(() => {
    global.fetch = jest.fn();
    console.warn = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    console.warn = originalWarn;
  });

  it('retries session bootstrap after transient startup failures', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: false, status: 504 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ runId: 'run-1', seqStart: 0 })
      });

    const sink = new WeatherLogSink({
      retryDelayMs: 10,
      maxRetryDelayMs: 20
    });

    const firstAttempt = await sink.init();
    expect(firstAttempt).toBeNull();
    expect(sink.isReady()).toBe(false);

    await waitFor(30);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(sink.isReady()).toBe(true);
    expect(sink.getSession()).toEqual({ runId: 'run-1', seqStart: 0 });
  });

  it('requeues buffered lines after a transient log post failure', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ runId: 'run-2', seqStart: 0 })
      })
      .mockResolvedValueOnce({ ok: false, status: 504 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ runId: 'run-2b', seqStart: 0 })
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, lines: 1 }) });

    const sink = new WeatherLogSink({
      flushIntervalMs: 5,
      retryDelayMs: 10,
      maxRetryDelayMs: 20
    });

    await sink.init();
    sink._queue.push('{"sample":1}');
    await sink._flush();
    expect(sink.isReady()).toBe(false);
    expect(sink._queue).toEqual(['{"sample":1}']);

    await sink.init();
    await sink._flush();

    const requestedUrls = global.fetch.mock.calls.map(([url]) => url);
    expect(requestedUrls).toEqual([
      '/__weatherlog/session',
      '/__weatherlog/log',
      '/__weatherlog/session',
      '/__weatherlog/log'
    ]);
    expect(sink.isReady()).toBe(true);
    expect(sink._queue).toHaveLength(0);
  });
});
