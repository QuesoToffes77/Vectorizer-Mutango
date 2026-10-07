/**
 * Operaciones de imagen puras sobre objetos tipo ImageData ({ width, height, data }).
 * No dependen del DOM, así que se pueden usar dentro de un Web Worker.
 */

/** Diferencia de color (distancia rectilínea RGBA) entre dos píxeles. */
function colorDistance(data, a, b) {
  return (
    Math.abs(data[a] - data[b]) +
    Math.abs(data[a + 1] - data[b + 1]) +
    Math.abs(data[a + 2] - data[b + 2]) +
    Math.abs(data[a + 3] - data[b + 3])
  );
}

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

/**
 * Detecta si la imagen es pixel art escalado (bloques de k×k píxeles iguales)
 * y devuelve k. Devuelve 1 si no encuentra una grilla clara.
 */
export function detectPixelSize(img, { tolerance = 24, samples = 24 } = {}) {
  const { width, height, data } = img;
  let k = 0;
  let runs = 0;

  const scan = (length, count, indexOf) => {
    for (let s = 0; s < samples; s++) {
      const line = Math.floor(((s + 0.5) / samples) * count);
      let start = 0;
      for (let i = 1; i < length; i++) {
        if (colorDistance(data, indexOf(line, i), indexOf(line, i - 1)) > tolerance) {
          // Ignoramos el primer tramo: puede estar cortado por el borde
          if (start > 0) {
            k = gcd(k, i - start);
            runs++;
          }
          start = i;
        }
      }
    }
  };

  scan(width, height, (row, x) => (row * width + x) * 4);
  scan(height, width, (col, y) => (y * width + col) * 4);

  if (runs < 8 || k < 2 || k > 64) return 1;
  return k;
}

/** Reduce la imagen tomando el píxel central de cada bloque k×k. */
export function downsampleNearest(img, k) {
  const width = Math.floor(img.width / k);
  const height = Math.floor(img.height / k);
  const data = new Uint8ClampedArray(width * height * 4);
  const offset = Math.floor(k / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = ((y * k + offset) * img.width + (x * k + offset)) * 4;
      const dst = (y * width + x) * 4;
      data[dst] = img.data[src];
      data[dst + 1] = img.data[src + 1];
      data[dst + 2] = img.data[src + 2];
      data[dst + 3] = img.data[src + 3];
    }
  }
  return { width, height, data };
}

/**
 * Convierte a RGBA premultiplicado en Float32. Así, al interpolar o desenfocar,
 * los píxeles transparentes no "manchan" de negro los bordes.
 */
function toPremultiplied(img) {
  const out = new Float32Array(img.data.length);
  for (let i = 0; i < img.data.length; i += 4) {
    const a = img.data[i + 3] / 255;
    out[i] = img.data[i] * a;
    out[i + 1] = img.data[i + 1] * a;
    out[i + 2] = img.data[i + 2] * a;
    out[i + 3] = img.data[i + 3];
  }
  return out;
}

function fromPremultiplied(buf, width, height) {
  const data = new Uint8ClampedArray(buf.length);
  for (let i = 0; i < buf.length; i += 4) {
    const a = buf[i + 3];
    if (a > 0) {
      const inv = 255 / a;
      data[i] = buf[i] * inv;
      data[i + 1] = buf[i + 1] * inv;
      data[i + 2] = buf[i + 2] * inv;
    }
    data[i + 3] = a;
  }
  return { width, height, data };
}

/** Reescala con interpolación bilineal (bordes clampeados). */
function resizeBilinearRaw(src, sw, sh, dw, dh) {
  const out = new Float32Array(dw * dh * 4);
  const sx = sw / dw;
  const sy = sh / dh;

  for (let y = 0; y < dh; y++) {
    const fy = Math.min(Math.max((y + 0.5) * sy - 0.5, 0), sh - 1);
    const y0 = Math.floor(fy);
    const y1 = Math.min(y0 + 1, sh - 1);
    const ty = fy - y0;

    for (let x = 0; x < dw; x++) {
      const fx = Math.min(Math.max((x + 0.5) * sx - 0.5, 0), sw - 1);
      const x0 = Math.floor(fx);
      const x1 = Math.min(x0 + 1, sw - 1);
      const tx = fx - x0;

      const i00 = (y0 * sw + x0) * 4;
      const i10 = (y0 * sw + x1) * 4;
      const i01 = (y1 * sw + x0) * 4;
      const i11 = (y1 * sw + x1) * 4;
      const o = (y * dw + x) * 4;

      for (let c = 0; c < 4; c++) {
        const top = src[i00 + c] + (src[i10 + c] - src[i00 + c]) * tx;
        const bottom = src[i01 + c] + (src[i11 + c] - src[i01 + c]) * tx;
        out[o + c] = top + (bottom - top) * ty;
      }
    }
  }
  return out;
}

/** Desenfoque gaussiano separable (bordes clampeados). */
function gaussianBlurRaw(buf, width, height, sigma) {
  if (sigma < 0.3) return buf;

  const radius = Math.ceil(sigma * 3);
  const kernel = new Float32Array(radius * 2 + 1);
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const w = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel[i + radius] = w;
    sum += w;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;

  const tmp = new Float32Array(buf.length);
  const out = new Float32Array(buf.length);

  // Horizontal
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = -radius; k <= radius; k++) {
        const xx = Math.min(Math.max(x + k, 0), width - 1);
        const i = (y * width + xx) * 4;
        const w = kernel[k + radius];
        r += buf[i] * w; g += buf[i + 1] * w; b += buf[i + 2] * w; a += buf[i + 3] * w;
      }
      const o = (y * width + x) * 4;
      tmp[o] = r; tmp[o + 1] = g; tmp[o + 2] = b; tmp[o + 3] = a;
    }
  }

  // Vertical
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = -radius; k <= radius; k++) {
        const yy = Math.min(Math.max(y + k, 0), height - 1);
        const i = (yy * width + x) * 4;
        const w = kernel[k + radius];
        r += tmp[i] * w; g += tmp[i + 1] * w; b += tmp[i + 2] * w; a += tmp[i + 3] * w;
      }
      const o = (y * width + x) * 4;
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = a;
    }
  }
  return out;
}

/**
 * Agranda la imagen con interpolación bilineal y la desenfoca.
 * Esto convierte los "escalones" de los píxeles en rampas suaves: al
 * cuantizar los colores después, los bordes quedan curvos en vez de dentados.
 */
export function resampleAndSmooth(img, scale, sigma) {
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  let buf = toPremultiplied(img);
  buf = resizeBilinearRaw(buf, img.width, img.height, width, height);
  buf = gaussianBlurRaw(buf, width, height, sigma);
  return fromPremultiplied(buf, width, height);
}
