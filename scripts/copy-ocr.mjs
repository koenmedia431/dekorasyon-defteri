// Metin tanıma (OCR) dosyalarını public/ocr altına kopyalar; böylece uygulama
// harici bir CDN'e bağımlı olmadan kendi sitesinden yükler.
import { cpSync, mkdirSync } from 'node:fs';

const out = 'public/ocr';
mkdirSync(`${out}/core`, { recursive: true });
mkdirSync(`${out}/lang`, { recursive: true });
cpSync('node_modules/tesseract.js/dist/worker.min.js', `${out}/worker.min.js`);
for (const v of ['', 'simd-', 'relaxedsimd-']) {
  cpSync(`node_modules/tesseract.js-core/tesseract-core-${v}lstm.wasm.js`, `${out}/core/tesseract-core-${v}lstm.wasm.js`);
}
cpSync('node_modules/@tesseract.js-data/tur/4.0.0_best_int/tur.traineddata.gz', `${out}/lang/tur.traineddata.gz`);
console.log('OCR dosyaları kopyalandı:', out);
