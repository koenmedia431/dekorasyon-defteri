// Yazdırılacak belgeyi tek bir A4 sayfasına sığdırır.
// Belge, sayfanın yazılabilir genişliğinde ölçülür; uzunsa ölçeklenerek (transform: scale)
// küçültülür, genişlik de aynı oranda artırılarak sayfa eni tam kullanılır. Sonuç CSS
// değişkenlerine yazılır; index.css'teki .fit-box / .fit-page kuralları yalnızca yazdırırken uygular.
// (zoom yerine transform: zoom küçük oranlarda satır yüksekliklerini yuvarlayıp taşırıyor.)

const MM = 96 / 25.4;
// @page { size: A4; margin: 14mm 12mm } ile uyumlu: 210-24 x 297-28
const PAGE_W = 186 * MM;
const PAGE_H = 269 * MM * 0.98; // yazıcı farkı için küçük pay
const MIN_SCALE = 0.05;

function heightAt(el: HTMLElement, scale: number): number {
  el.style.width = `${PAGE_W / scale}px`;
  return el.scrollHeight * scale;
}

export function fitToPage(el: HTMLElement): number {
  el.classList.add('fit-measuring');
  el.classList.remove('fit-dense');
  let scale = 1;
  if (heightAt(el, 1) > PAGE_H) {
    // Sığmıyorsa önce satır aralarını sıkılaştır, yazı mümkün olduğunca büyük kalsın
    el.classList.add('fit-dense');
    let lo = MIN_SCALE;
    let hi = 1;
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2;
      if (heightAt(el, mid) <= PAGE_H) lo = mid;
      else hi = mid;
    }
    scale = lo;
  }
  // Ölçeklenmiş belgenin sayfada kaplayacağı yükseklik (kutu bu kadar yer ayırır)
  const boxHeight = Math.ceil(heightAt(el, scale)) + 2;
  el.style.width = '';
  el.classList.remove('fit-measuring');
  el.style.setProperty('--print-scale', String(scale));
  el.style.setProperty('--print-width', `${PAGE_W / scale}px`);
  el.parentElement?.style.setProperty('--print-box-h', `${boxHeight}px`);
  return scale;
}
