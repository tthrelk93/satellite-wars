import test from 'node:test';
import assert from 'node:assert/strict';
import { loadImageData } from './climatology.js';

const withMockedGlobals = async (overrides, fn) => {
  const originals = new Map();
  for (const [key, value] of Object.entries(overrides)) {
    originals.set(key, globalThis[key]);
    if (value === undefined) {
      delete globalThis[key];
    } else {
      globalThis[key] = value;
    }
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of originals.entries()) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
};

test('loadImageData uses bitmap decoding when DOM image APIs are unavailable', async () => {
  const expected = new Uint8ClampedArray([
    1, 2, 3, 255,
    4, 5, 6, 255,
    7, 8, 9, 255,
    10, 11, 12, 255
  ]);

  const calls = [];
  class MockOffscreenCanvas {
    constructor(width, height) {
      this.width = width;
      this.height = height;
    }

    getContext(kind) {
      assert.equal(kind, '2d');
      return {
        drawImage(bitmap, x, y) {
          calls.push({ kind: 'drawImage', width: bitmap.width, height: bitmap.height, x, y });
        },
        getImageData(x, y, width, height) {
          calls.push({ kind: 'getImageData', x, y, width, height });
          return { data: expected };
        }
      };
    }
  }

  await withMockedGlobals(
    {
      Image: undefined,
      document: undefined,
      OffscreenCanvas: MockOffscreenCanvas,
      fetch: async (url) => {
        calls.push({ kind: 'fetch', url });
        return {
          ok: true,
          blob: async () => ({ tag: 'blob' })
        };
      },
      createImageBitmap: async (blob) => {
        calls.push({ kind: 'createImageBitmap', blob });
        return {
          width: 2,
          height: 2,
          close() {
            calls.push({ kind: 'closeBitmap' });
          }
        };
      }
    },
    async () => {
      const result = await loadImageData('/climo/soilcap.png');
      assert.equal(result.width, 2);
      assert.equal(result.height, 2);
      assert.deepEqual(Array.from(result.data), Array.from(expected));
    }
  );

  assert.deepEqual(
    calls.map((entry) => entry.kind),
    ['fetch', 'createImageBitmap', 'drawImage', 'getImageData', 'closeBitmap']
  );
});
