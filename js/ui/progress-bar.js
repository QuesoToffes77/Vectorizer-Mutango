/** Barra de progreso accesible (role="progressbar"). */
export class ProgressBar {
  #root;
  #fill;

  /** @param {HTMLElement} root */
  constructor(root) {
    this.#root = root;
    this.#fill = root.querySelector('.progress__fill');
  }

  /** @param {number} value de 0 a 1 */
  set(value) {
    const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
    this.#fill.style.width = `${percent}%`;
    this.#root.setAttribute('aria-valuenow', percent);
  }

  show() {
    this.set(0);
    this.#root.hidden = false;
  }

  hide() {
    this.#root.hidden = true;
  }
}
