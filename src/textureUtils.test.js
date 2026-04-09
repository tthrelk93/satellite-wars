import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { applyTextureAnisotropy, textureHasUploadableImageData } from './textureUtils.js';

test('textureHasUploadableImageData rejects textures without an image payload', () => {
  const texture = new THREE.Texture();
  assert.equal(textureHasUploadableImageData(texture), false);
});

test('textureHasUploadableImageData rejects zero-sized image placeholders', () => {
  const texture = new THREE.Texture();
  texture.image = { width: 0, height: 512 };
  assert.equal(textureHasUploadableImageData(texture), false);
});

test('textureHasUploadableImageData accepts standard image-like payloads with real dimensions', () => {
  const texture = new THREE.Texture();
  texture.image = { width: 1024, height: 512 };
  assert.equal(textureHasUploadableImageData(texture), true);
});

test('textureHasUploadableImageData accepts DataTexture payloads with bytes', () => {
  const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
  assert.equal(textureHasUploadableImageData(texture), true);
});

test('applyTextureAnisotropy skips needsUpdate for unloaded textures but still stores anisotropy', () => {
  const texture = new THREE.Texture();
  const updated = applyTextureAnisotropy(texture, 8);
  assert.equal(updated, false);
  assert.equal(texture.anisotropy, 8);
  assert.equal(texture.version, 0);
});

test('applyTextureAnisotropy marks ready textures for upload', () => {
  const texture = new THREE.Texture();
  texture.image = { width: 1024, height: 512 };
  const updated = applyTextureAnisotropy(texture, 4);
  assert.equal(updated, true);
  assert.equal(texture.anisotropy, 4);
  assert.equal(texture.version, 1);
});
