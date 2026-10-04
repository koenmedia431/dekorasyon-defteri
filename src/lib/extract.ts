// Yüklenen PDF / görselden metin çıkarır (tamamen tarayıcıda çalışır).
// PDF'te metin katmanı varsa doğrudan okunur; taranmış PDF ve görsellerde Türkçe OCR yapılır.

export type Progress = (stage: string, ratio?: number) => void;

const BASE = import.meta.env.BASE_URL;

async function ocrCanvasesOrImages(sources: (HTMLCanvasElement | Blob)[], onProgress: Progress): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  onProgress('Metin tanıma hazırlanıyor (ilk seferde biraz sürebilir)…');
  const worker = await createWorker('tur', 1, {
    workerPath: `${BASE}ocr/worker.min.js`,
    corePath: `${BASE}ocr/core`,
    langPath: `${BASE}ocr/lang`,
    logger: m => {
      if (m.status === 'recognizing text') onProgress('Yazılar okunuyor…', m.progress);
    },
  });
  try {
    const parts: string[] = [];
    for (const src of sources) {
      const { data } = await worker.recognize(src);
      parts.push(data.text);
    }
    return parts.join('\n');
  } finally {
    await worker.terminate();
  }
}

// Büyük fotoğrafları küçült: OCR hızlanır, doğruluk düşmez
async function downscale(file: Blob, maxSide = 2200): Promise<Blob | HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  if (scale === 1) return file;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function extractPdf(file: File, onProgress: Progress): Promise<string> {
  onProgress('PDF açılıyor…');
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pageCount = Math.min(pdf.numPages, 5);

  // 1) Metin katmanı
  const texts: string[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Aynı satırdaki parçaları birleştir (y koordinatına göre)
    let lastY: number | null = null;
    let line = '';
    const lines: string[] = [];
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const y = Math.round(item.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        lines.push(line.trim());
        line = '';
      }
      line += item.str + (item.hasEOL ? '' : ' ');
      lastY = y;
    }
    lines.push(line.trim());
    texts.push(lines.filter(Boolean).join('\n'));
  }
  const text = texts.join('\n');
  if (text.replace(/\s/g, '').length > 40) return text;

  // 2) Taranmış PDF: sayfaları resme çevirip OCR
  const canvases: HTMLCanvasElement[] = [];
  for (let i = 1; i <= Math.min(pageCount, 3); i++) {
    onProgress(`Sayfa ${i} resme çevriliyor…`);
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
    canvases.push(canvas);
  }
  return ocrCanvasesOrImages(canvases, onProgress);
}

export async function extractText(file: File, onProgress: Progress): Promise<string> {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return extractPdf(file, onProgress);
  const src = await downscale(file);
  return ocrCanvasesOrImages([src], onProgress);
}
