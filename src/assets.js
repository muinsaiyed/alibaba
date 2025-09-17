import { assetSources, images } from './state.js';

export function loadAssets() {
  const entries = Object.entries(assetSources);
  return Promise.all(
    entries.map(([key, src]) =>
      loadImage(src).then((img) => {
        images[key] = img;
      }),
    ),
  );
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
}
