const MIN_ZOOM = 0.05;
const MAX_ZOOM = 50;
const FIT_MARGIN = 0.95;

/**
 * Visor de SVG con zoom (rueda, pellizco, botones) y desplazamiento (arrastrar).
 */
export class SvgViewer {
  #container;
  #stage;
  #view = { x: 0, y: 0, scale: 1 };
  #size = { width: 1, height: 1 };
  #pointers = new Map();
  #lastPinchDistance = 0;

  /** @param {HTMLElement} container */
  constructor(container) {
    this.#container = container;
    this.#stage = document.createElement('div');
    this.#stage.className = 'viewer__stage';
    container.append(this.#stage);
    this.#bindEvents();
  }

  /** @param {string} svgMarkup */
  show(svgMarkup) {
    this.#stage.innerHTML = svgMarkup;
    const svg = this.#stage.querySelector('svg');
    const viewBox = svg.viewBox.baseVal;
    this.#size = {
      width: viewBox?.width || Number(svg.getAttribute('width')),
      height: viewBox?.height || Number(svg.getAttribute('height')),
    };
    svg.setAttribute('width', this.#size.width);
    svg.setAttribute('height', this.#size.height);
    this.fit();
  }

  clear() {
    this.#stage.innerHTML = '';
  }

  fit() {
    const { width, height } = this.#container.getBoundingClientRect();
    const scale = Math.min(width / this.#size.width, height / this.#size.height) * FIT_MARGIN;
    this.#view = {
      scale,
      x: (width - this.#size.width * scale) / 2,
      y: (height - this.#size.height * scale) / 2,
    };
    this.#render();
  }

  /** Zoom manteniendo fijo el punto (cx, cy) del contenedor. Por defecto, el centro. */
  zoomBy(factor, cx, cy) {
    if (cx === undefined) {
      const rect = this.#container.getBoundingClientRect();
      cx = rect.width / 2;
      cy = rect.height / 2;
    }
    const view = this.#view;
    const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.scale * factor));
    const applied = scale / view.scale;
    view.x = cx - (cx - view.x) * applied;
    view.y = cy - (cy - view.y) * applied;
    view.scale = scale;
    this.#render();
  }

  #render() {
    const { x, y, scale } = this.#view;
    this.#stage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }

  #localPoint(clientX, clientY) {
    const rect = this.#container.getBoundingClientRect();
    return [clientX - rect.left, clientY - rect.top];
  }

  #bindEvents() {
    const el = this.#container;

    el.addEventListener('wheel', (event) => {
      event.preventDefault();
      this.zoomBy(Math.exp(-event.deltaY * 0.0015), ...this.#localPoint(event.clientX, event.clientY));
    }, { passive: false });

    el.addEventListener('pointerdown', (event) => {
      el.setPointerCapture(event.pointerId);
      this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      el.classList.add('is-dragging');
    });

    el.addEventListener('pointermove', (event) => {
      const previous = this.#pointers.get(event.pointerId);
      if (!previous) return;
      this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (this.#pointers.size === 1) {
        this.#view.x += event.clientX - previous.x;
        this.#view.y += event.clientY - previous.y;
        this.#render();
      } else if (this.#pointers.size === 2) {
        const [a, b] = [...this.#pointers.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.#lastPinchDistance) {
          this.zoomBy(distance / this.#lastPinchDistance, ...this.#localPoint((a.x + b.x) / 2, (a.y + b.y) / 2));
        }
        this.#lastPinchDistance = distance;
      }
    });

    const release = (event) => {
      this.#pointers.delete(event.pointerId);
      this.#lastPinchDistance = 0;
      if (this.#pointers.size === 0) el.classList.remove('is-dragging');
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);

    el.addEventListener('dblclick', () => this.fit());
  }
}
