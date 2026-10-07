/** Descarga un texto como archivo. */
export function downloadText(text, filename, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Saca la extensión a un nombre de archivo. */
export function baseName(filename, fallback = 'imagen') {
  return filename.replace(/\.[^.]+$/, '') || fallback;
}
