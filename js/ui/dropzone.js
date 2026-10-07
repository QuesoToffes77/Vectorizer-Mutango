/**
 * Zona para subir una imagen con click o arrastrando.
 * Emite el archivo elegido con `onFile`.
 */
export class Dropzone {
  #root;
  #input;
  #preview;

  /**
   * @param {HTMLElement} root  elemento .dropzone (un <label> que contiene el <input type="file">)
   * @param {{ onFile: (file: File) => void }} handlers
   */
  constructor(root, { onFile }) {
    this.#root = root;
    this.#input = root.querySelector('input[type="file"]');
    this.#preview = root.querySelector('.dropzone__preview');

    this.#input.addEventListener('change', () => {
      const [file] = this.#input.files;
      if (file) onFile(file);
    });

    root.addEventListener('dragenter', (e) => this.#onDragOver(e));
    root.addEventListener('dragover', (e) => this.#onDragOver(e));
    root.addEventListener('dragleave', () => root.classList.remove('is-over'));
    root.addEventListener('drop', (event) => {
      event.preventDefault();
      root.classList.remove('is-over');
      const file = [...event.dataTransfer.files].find((f) => f.type.startsWith('image/'));
      if (file) onFile(file);
    });
  }

  /** Muestra una vista previa de la imagen cargada. */
  showPreview(src) {
    this.#preview.src = src;
    this.#root.classList.add('has-image');
  }

  reset() {
    this.#input.value = '';
    this.#preview.removeAttribute('src');
    this.#root.classList.remove('has-image');
  }

  #onDragOver(event) {
    event.preventDefault();
    this.#root.classList.add('is-over');
  }
}
