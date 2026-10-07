# Vectorizer

Subí una foto y convertila a SVG directo en el navegador. Nada se sube a ningún servidor.

**Demo:** https://quesotoffes77.github.io/Vectorizer-Mutango/

## Cómo funciona

1. **Detección de pixel art:** si la imagen es pixel art agrandado, se reduce a su resolución real.
2. **Paleta:** se sacan los colores de la imagen original.
3. **Suavizado:** se agranda con interpolación bilineal y se desenfoca, así los bordes dejan de seguir los píxeles.
4. **Trazado:** cada color se convierte en curvas con [ImageTracer](https://github.com/jankovicsandras/imagetracerjs), en un Web Worker para no congelar la página.

## Estructura

```
index.html
css/styles.css
js/
  main.js                     # arranque y flujo de la app
  ui/dropzone.js              # subir / arrastrar imagen
  ui/progress-bar.js          # barra de carga
  ui/svg-viewer.js            # visor con zoom y desplazamiento
  utils/download.js           # descarga del SVG
  vectorizer/vectorizer.js    # API: lee la imagen y habla con el worker
  vectorizer/vectorize.worker.js  # pipeline de vectorizado
  vectorizer/image-ops.js     # operaciones de imagen (reescalado, desenfoque, etc.)
  vectorizer/imagetracer.js   # wrapper ES module de ImageTracer
vendor/imagetracer_v1.2.6.js  # ImageTracer (dominio público)
```

## Correr localmente

Usa ES modules y Web Workers, así que hay que servirlo por HTTP (abrir el archivo con doble click no anda):

```bash
python -m http.server 8000
```

y abrir http://localhost:8000.
