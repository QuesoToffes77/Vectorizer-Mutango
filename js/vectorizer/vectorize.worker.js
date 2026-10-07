/**
 * Web Worker que hace todo el trabajo pesado, para no congelar la interfaz.
 *
 * Mensajes de entrada:  { image: { width, height, data } }
 * Mensajes de salida:   { type: 'progress', value: 0..1 }
 *                       { type: 'done', svg: string }
 *                       { type: 'error', message: string }
 */
import ImageTracer from './imagetracer.js';
import { detectPixelSize, downsampleNearest, resampleAndSmooth } from './image-ops.js';

/** Tamaño (lado más largo) al que llevamos la imagen antes de trazar. */
const WORK_SIZE = 1200;
const MAX_UPSCALE = 12;
const NUMBER_OF_COLORS = 16;
/** Desenfoque en "píxeles originales": cuánto se redondean los escalones. */
const SMOOTHING = 0.9;

const report = (value) => self.postMessage({ type: 'progress', value });

self.onmessage = ({ data }) => {
  try {
    self.postMessage({ type: 'done', svg: vectorize(data.image) });
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message || String(err) });
  }
};

function vectorize(input) {
  // 1. Si es pixel art agrandado, volvemos a su resolución real
  const pixelSize = detectPixelSize(input);
  const source = pixelSize > 1 ? downsampleNearest(input, pixelSize) : input;
  report(0.05);

  // 2. Paleta de colores sacada de la imagen original (sin desenfocar),
  //    así el suavizado no inventa colores intermedios en los bordes
  const palette = extractPalette(source);
  report(0.15);

  // 3. Agrandar + desenfocar para que los bordes dejen de seguir los píxeles
  const scale = Math.min(MAX_UPSCALE, WORK_SIZE / Math.max(source.width, source.height));
  const smoothed = resampleAndSmooth(source, scale, SMOOTHING * Math.max(scale, 1));
  report(0.3);

  // 4. Trazado capa por capa (una capa por color)
  const options = ImageTracer.checkoptions({
    pal: palette,
    colorquantcycles: 1,
    // ltres bajo = preferir curvas antes que rectas
    ltres: 0.2,
    qtres: 1.5,
    pathomit: Math.round(8 * Math.max(scale, 1)),
    rightangleenhance: false,
    linefilter: true,
    roundcoords: 2,
    viewbox: true,
    // Devolvemos el SVG al tamaño de la imagen original
    scale: input.width / smoothed.width,
  });

  const quantized = ImageTracer.colorquantization(smoothed, options);
  const layers = [];
  for (let i = 0; i < quantized.palette.length; i++) {
    const layer = ImageTracer.layeringstep(quantized, i);
    const paths = ImageTracer.pathscan(layer, options.pathomit);
    const nodes = ImageTracer.internodes(paths, options);
    layers.push(ImageTracer.batchtracepaths(nodes, options.ltres, options.qtres));
    report(0.3 + 0.65 * ((i + 1) / quantized.palette.length));
  }

  const tracedata = {
    layers,
    palette: quantized.palette,
    width: smoothed.width,
    height: smoothed.height,
  };
  const svg = ImageTracer.getsvgstring(tracedata, options);
  report(1);
  return svg;
}

/** Cuantiza la imagen y se queda solo con los colores que realmente se usan. */
function extractPalette(img) {
  const options = ImageTracer.checkoptions({ numberofcolors: NUMBER_OF_COLORS });
  // colorquantization puede reemplazar img.data, así que le pasamos una copia
  const { array, palette } = ImageTracer.colorquantization(
    { width: img.width, height: img.height, data: img.data },
    options,
  );

  const used = new Set();
  for (const row of array) for (const index of row) if (index >= 0) used.add(index);

  const seen = new Set();
  return palette.filter((color, i) => {
    const key = `${color.r},${color.g},${color.b},${color.a}`;
    if (!used.has(i) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
