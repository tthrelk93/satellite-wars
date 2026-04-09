const positiveDimension = (value) => (Number.isFinite(value) && value > 0 ? value : 0);

const getTextureImage = (texture) => texture?.image ?? texture?.source?.data ?? null;

const getTextureImageWidth = (image) => (
  positiveDimension(image?.videoWidth)
  || positiveDimension(image?.naturalWidth)
  || positiveDimension(image?.width)
);

const getTextureImageHeight = (image) => (
  positiveDimension(image?.videoHeight)
  || positiveDimension(image?.naturalHeight)
  || positiveDimension(image?.height)
);

export const textureHasUploadableImageData = (texture) => {
  const image = getTextureImage(texture);
  if (!image) return false;

  const width = getTextureImageWidth(image);
  const height = getTextureImageHeight(image);
  if (!width || !height) return false;

  if ('data' in image) {
    if (image.data == null) return false;
    if (ArrayBuffer.isView(image.data)) return image.data.length > 0;
    if (image.data instanceof ArrayBuffer) return image.data.byteLength > 0;
  }

  return true;
};

export const applyTextureAnisotropy = (texture, anisotropy) => {
  if (!texture) return false;
  texture.anisotropy = anisotropy;
  if (!textureHasUploadableImageData(texture)) return false;
  texture.needsUpdate = true;
  return true;
};
