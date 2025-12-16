// renderer.js: bridge fields to textures (placeholder for future GPU/instancing)
export function updateTexturesFromFields(fields, tex) {
  // Fields -> texture mapping should be implemented by the visualization layer.
  // Here we simply mark textures dirty if provided.
  if (tex) tex.needsUpdate = true;
}

export function renderFrame() {
  // Intentionally empty placeholder; rendering handled in WeatherField/Earth layer.
}

