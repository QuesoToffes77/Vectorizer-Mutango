/** Lado máximo con el que leemos la imagen (evita usar memoria de más). */
const MAX_INPUT_SIDE = 2400;

/**
 * API del lado de la página: lee la imagen y delega el trabajo al Web Worker.
 */
export class Vectorizer {
  #worker = null;

  /**
   * @param {HTMLImageElement} image
   * @param {(progress: number) => void} [onProgress] recibe valores de 0 a 1
   * @returns {Promise<string>} el SVG como texto
   */
  vectorize(image, onProgress = () => {}) {
    this.cancel();
    const imageData = readImageData(image);

    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./vectorize.worker.js', import.meta.url), { type: 'module' });
      this.#worker = worker;

      worker.onmessage = ({ data }) => {
        if (data.type === 'progress') {
          onProgress(data.value);
          return;
        }
        this.cancel();
        if (data.type === 'done') resolve(data.svg);
        else reject(new Error(data.message));
      };
      worker.onerror = (event) => {
        this.cancel();
        reject(new Error(event.message || 'Error en el worker'));
      };

      // Transferimos el buffer en vez de copiarlo
      worker.postMessage(
        { image: { width: imageData.width, height: imageData.height, data: imageData.data } },
        [imageData.data.buffer],
      );
    });
  }

  cancel() {
    this.#worker?.terminate();
    this.#worker = null;
  }
}

function readImageData(image) {
  const scale = Math.min(1, MAX_INPUT_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.round(image.naturalWidth * scale);
  const height = Math.round(image.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  // Sin suavizado: si es pixel art queremos los bloques intactos para detectarlos
  ctx.imageSmoothingEnabled = scale < 1;
  ctx.drawImage(image, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}
