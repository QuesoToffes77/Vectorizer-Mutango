import { Dropzone } from './ui/dropzone.js';
import { ProgressBar } from './ui/progress-bar.js';
import { SvgViewer } from './ui/svg-viewer.js';
import { Vectorizer } from './vectorizer/vectorizer.js';
import { baseName, downloadText } from './utils/download.js';

const elements = {
  uploadStep: document.querySelector('#upload-step'),
  resultStep: document.querySelector('#result-step'),
  vectorizeButton: document.querySelector('#vectorize-button'),
  downloadButton: document.querySelector('#download-button'),
  restartButton: document.querySelector('#restart-button'),
  zoomInButton: document.querySelector('#zoom-in'),
  zoomOutButton: document.querySelector('#zoom-out'),
  fitButton: document.querySelector('#zoom-fit'),
  error: document.querySelector('#error'),
};

const state = {
  image: null,
  imageUrl: null,
  fileName: 'imagen',
  svg: null,
};

const vectorizer = new Vectorizer();
const progress = new ProgressBar(document.querySelector('#progress'));
const viewer = new SvgViewer(document.querySelector('#viewer'));
const dropzone = new Dropzone(document.querySelector('#dropzone'), { onFile: loadFile });

elements.vectorizeButton.addEventListener('click', vectorize);
elements.downloadButton.addEventListener('click', () => {
  downloadText(state.svg, `${state.fileName}.svg`, 'image/svg+xml');
});
elements.restartButton.addEventListener('click', restart);
elements.zoomInButton.addEventListener('click', () => viewer.zoomBy(1.25));
elements.zoomOutButton.addEventListener('click', () => viewer.zoomBy(0.8));
elements.fitButton.addEventListener('click', () => viewer.fit());

async function loadFile(file) {
  showError(null);
  try {
    const url = URL.createObjectURL(file);
    const image = await loadImage(url);
    releaseImage();
    Object.assign(state, { image, imageUrl: url, fileName: baseName(file.name) });
    dropzone.showPreview(url);
    elements.vectorizeButton.disabled = false;
  } catch {
    showError('No se pudo abrir la imagen. Probá con otro archivo.');
  }
}

async function vectorize() {
  if (!state.image) return;
  showError(null);
  elements.vectorizeButton.disabled = true;
  progress.show();

  try {
    state.svg = await vectorizer.vectorize(state.image, (value) => progress.set(value));
    showResult();
  } catch (err) {
    console.error(err);
    showError('Algo salió mal al vectorizar. Probá de nuevo.');
    elements.vectorizeButton.disabled = false;
  } finally {
    progress.hide();
  }
}

function showResult() {
  elements.uploadStep.hidden = true;
  elements.resultStep.hidden = false;
  viewer.show(state.svg);
}

function restart() {
  vectorizer.cancel();
  releaseImage();
  Object.assign(state, { image: null, imageUrl: null, svg: null });
  dropzone.reset();
  viewer.clear();
  elements.vectorizeButton.disabled = true;
  elements.resultStep.hidden = true;
  elements.uploadStep.hidden = false;
}

function releaseImage() {
  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function showError(message) {
  elements.error.textContent = message ?? '';
  elements.error.hidden = !message;
}
