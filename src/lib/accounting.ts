// Para/tarih biçimlendirme, ekstre hesabı ve sohbet ayrıştırıcısı.
// Saf fonksiyonlar; Supabase'e bağımlı değil (testler node ile çalışır).

export type EntryKind = 'debit' | 'credit' | 'expense' | 'advance';

export const KIND_LABELS: Record<EntryKind, string> = {
  debit: 'İş / Fatura',
  credit: 'Tahsilat',
  expense: 'Masraf',
  advance: 'Ortak Avansı',
};

// Avans alabilecek ortaklar
export const PARTNERS = ['Cihad', 'Mücahid', 'Emir'] as const;
export type Partner = (typeof PARTNERS)[number];

// ===================== BİÇİMLENDİRME =====================
export function formatMoney(value: number, withSymbol = true): string {
  const negative = value < 0;
  const [intPart, decPart] = Math.abs(value).toFixed(2).split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative ? '-' : ''}${grouped},${decPart}${withSymbol ? ' ₺' : ''}`;
}

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return toDateStr(d);
}

// YYYY-MM-DD -> DD.MM.YYYY
export function formatDate(date: string): string {
  const [y, m, d] = date.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

// "12.500,50" / "12500" / "12500.5" -> sayı
export function parseAmountInput(input: string): number {
  const s = input.trim().replace(/\s|₺|tl/gi, '');
  if (!s) return NaN;
  if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''));
  return Number(s);
}

// ===================== EKSTRE =====================
export interface LedgerEntry {
  id: string;
  entry_type: 'debit' | 'credit';
  amount: number;
  description: string;
  entry_date: string;
  created_at: string;
}

export interface StatementRow {
  entry: LedgerEntry;
  balance: number;
}

export interface Statement {
  opening: number;
  rows: StatementRow[];
  totalDebit: number;
  totalCredit: number;
  closing: number;
}

export function balanceOf(entries: Pick<LedgerEntry, 'entry_type' | 'amount'>[]): number {
  return entries.reduce((s, e) => s + (e.entry_type === 'debit' ? Number(e.amount) : -Number(e.amount)), 0);
}

export function balanceLabel(balance: number): string {
  if (Math.abs(balance) < 0.005) return 'Hesap kapalı';
  return balance > 0 ? 'Borçlu' : 'Alacaklı';
}

export function buildStatement(entries: LedgerEntry[], from?: string, to?: string): Statement {
  const sorted = [...entries].sort((a, b) =>
    a.entry_date !== b.entry_date ? (a.entry_date < b.entry_date ? -1 : 1) : a.created_at < b.created_at ? -1 : 1
  );
  let opening = 0;
  let running = 0;
  let totalDebit = 0;
  let totalCredit = 0;
  const rows: StatementRow[] = [];
  for (const e of sorted) {
    const amount = Number(e.amount);
    const delta = e.entry_type === 'debit' ? amount : -amount;
    if (from && e.entry_date < from) {
      opening += delta;
      running += delta;
      continue;
    }
    if (to && e.entry_date > to) continue;
    running += delta;
    if (e.entry_type === 'debit') totalDebit += amount;
    else totalCredit += amount;
    rows.push({ entry: e, balance: running });
  }
  return { opening, rows, totalDebit, totalCredit, closing: running };
}

export function statementToText(
  st: Statement,
  opts: { customerName: string; businessName?: string; from?: string; to?: string }
): string {
  const line = '------------------------------';
  const out: string[] = [];
  out.push(`${opts.businessName ? opts.businessName + ' — ' : ''}HESAP EKSTRESİ`);
  out.push(`Sayın ${opts.customerName}`);
  out.push(
    `Dönem: ${opts.from ? `${formatDate(opts.from)} - ${formatDate(opts.to || todayStr())}` : `Tüm hareketler (${formatDate(opts.to || todayStr())} itibarıyla)`}`
  );
  out.push(line);
  if (opts.from) out.push(`Devreden bakiye: ${formatMoney(st.opening)}`);
  for (const { entry, balance } of st.rows) {
    out.push(`${formatDate(entry.entry_date)}  ${entry.description}`);
    out.push(`   ${entry.entry_type === 'debit' ? 'Borç' : 'Ödeme'}: ${formatMoney(Number(entry.amount))}   Bakiye: ${formatMoney(balance)}`);
  }
  if (st.rows.length === 0) out.push('Bu dönemde hareket yok.');
  out.push(line);
  out.push(`Toplam borç: ${formatMoney(st.totalDebit)}`);
  out.push(`Toplam ödeme: ${formatMoney(st.totalCredit)}`);
  out.push(`GÜNCEL BAKİYE: ${formatMoney(Math.abs(st.closing))} (${balanceLabel(st.closing)})`);
  return out.join('\n');
}

// ===================== SOHBET AYRIŞTIRICI =====================
// "Salon boyası işçilik 18.000", "Ayşe hanım 10 bin kapora verdi",
// "dün boya aldım 3.250, usta yevmiyesi 1500" gibi metinlerden kayıt çıkarır.

export interface ParsedEntry {
  kind: EntryKind;
  amount: number;
  description: string;
  date: string;
  guessed: boolean; // tür anahtar kelimeden bulunamadıysa true
  partner?: Partner; // kind === 'advance' ise
}

const L = 'a-zA-ZçğıöşüÇĞİÖŞÜâîû';

const MONTHS: Record<string, number> = {
  ocak: 1, şubat: 2, subat: 2, mart: 3, nisan: 4, mayıs: 5, mayis: 5, haziran: 6,
  temmuz: 7, ağustos: 8, agustos: 8, eylül: 9, eylul: 9, ekim: 10, kasım: 11, kasim: 11, aralık: 12, aralik: 12,
};

// Sıra önemli: önce kesin ifadeler, sonra isimler
const EXPENSE_STRONG = ['masraf', 'gider', 'harcama', 'harcad', 'ödedim', 'ödedik', 'odedim', 'odedik', 'verdim', 'verdik', 'ödeme yaptım', 'ödeme yaptık', 'satın aldı'];
const CREDIT_STRONG = ['tahsil', 'ödedi', 'odedi', 'ödeme yaptı', 'ödeme geldi', 'para geldi', 'yatırdı', 'yatirdi', 'yatırıldı', 'gönderdi', 'gonderdi', 'havale', 'eft', 'fast', 'kapora', 'avans', 'peşinat', 'pesinat', 'çek verdi', 'çek geldi', 'senet'];
const EXPENSE_NOUNS = ['malzeme', 'boya', 'astar', 'macun', 'alçı', 'alci', 'fırça', 'rulo', 'vida', 'dübel', 'silikon', 'hırdavat', 'hirdavat', 'nalbur', 'usta', 'işçi', 'isci', 'kalfa', 'yevmiye', 'nakliye', 'kargo', 'yakıt', 'yakit', 'benzin', 'mazot', 'yemek', 'otopark', 'kira', 'taşeron', 'taseron', 'koli', 'bant', 'naylon', 'kağıt', 'kağıd', 'zımpara', 'zimpara'];
const PURCHASE_VERBS = ['aldım', 'aldık', 'aldim', 'aldik', 'alındı', 'alindi', 'alınd', 'satın'];
// Malzeme adı geçse de yapılan işi anlatan kelimeler (ör. "salon boyası işçilik")
// Kökler: Türkçe ses değişimine dayanıklı (işçilik → işçiliği, fatura → faturası, hakediş → hakedişi)
const DEBIT_STRONG = ['işçil', 'iscil', 'fatur', 'hakedi', 'uygulam', 'montaj', 'tadilat', 'bedel', 'iş=', 'işi=', 'işin=', 'işler=', 'işleri=', 'kesild', 'kestik'];
const CREDIT_WEAK = ['aldım', 'aldık', 'alındı', 'aldim', 'aldik', 'alindi', 'ödeme', 'odeme', 'nakit'];
const DEBIT_WORDS = ['fatur', 'iş=', 'işi=', 'işçil', 'iscil', 'bedel', 'tutar', 'borç', 'borc', 'hakedi', 'montaj', 'uygulama', 'keşif', 'kesif', 'sözleşme', 'tadilat', 'dekorasyon', 'tasarım', 'proje', 'teklif', 'kesild', 'kestik', 'kesti', 'salon', 'oda', 'mutfak', 'banyo', 'cephe', 'tavan', 'duvar', 'parke', 'seramik', 'fayans', 'kartonpiyer', 'asma tavan', 'boyandı', 'bitti', 'teslim'];

function trLower(s: string): string {
  return s.replace(/I/g, 'ı').replace(/İ/g, 'i').toLowerCase();
}

// "=" ile biten anahtar kelime tam eşleşir (ör. "iş=" "işçi"yi yakalamasın)
function hasKeyword(text: string, words: string[], keywords: string[]): boolean {
  return keywords.some(k => {
    if (k.includes(' ')) return text.includes(k);
    if (k.endsWith('=')) return words.includes(k.slice(0, -1));
    return words.some(w => w.startsWith(k));
  });
}

export function detectKind(text: string): EntryKind | null {
  const lower = trLower(text);
  const words = lower.split(new RegExp(`[^${L}]+`)).filter(Boolean);
  if (hasKeyword(lower, words, EXPENSE_STRONG)) return 'expense';
  if (hasKeyword(lower, words, CREDIT_STRONG)) return 'credit';
  const hasMaterial = hasKeyword(lower, words, EXPENSE_NOUNS);
  if (hasMaterial && hasKeyword(lower, words, PURCHASE_VERBS)) return 'expense';
  if (hasKeyword(lower, words, DEBIT_STRONG)) return 'debit';
  if (hasMaterial) return 'expense';
  if (hasKeyword(lower, words, CREDIT_WEAK)) return 'credit';
  if (hasKeyword(lower, words, DEBIT_WORDS)) return 'debit';
  return null;
}

// Metinde geçen ortağı bulur (ekleri tolere eder: "Cihad'a", "Emir'e", "Mücahit")
const PARTNER_STEMS: [string, Partner][] = [
  ['cihad', 'Cihad'],
  ['cihat', 'Cihad'],
  ['mücahid', 'Mücahid'],
  ['mücahit', 'Mücahid'],
  ['mucahid', 'Mücahid'],
  ['mucahit', 'Mücahid'],
  ['emir', 'Emir'],
];

export function detectPartner(text: string): Partner | null {
  const words = trLower(text).split(new RegExp(`[^${L}]+`)).filter(Boolean);
  for (const w of words) {
    const hit = PARTNER_STEMS.find(([stem]) => w.startsWith(stem));
    if (hit) return hit[1];
  }
  return null;
}

function mentionsMaterial(text: string): boolean {
  const lower = trLower(text);
  const words = lower.split(new RegExp(`[^${L}]+`)).filter(Boolean);
  return hasKeyword(lower, words, EXPENSE_NOUNS.filter(n => !['usta', 'işçi', 'isci', 'kalfa', 'yevmiye'].includes(n)));
}

function buildDate(d: number, mo: number, y?: number): string | null {
  const now = new Date();
  let year = y ? (y < 100 ? 2000 + y : y) : now.getFullYear();
  let date = new Date(year, mo - 1, d);
  if (date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  // Yıl yazılmadıysa ve tarih 1 aydan fazla ileride kalıyorsa geçen yıl kabul et
  if (!y && date.getTime() - now.getTime() > 31 * 86400000) {
    year -= 1;
    date = new Date(year, mo - 1, d);
  }
  return toDateStr(date);
}

// Metindeki tarihi bulur ve metinden çıkarır
function extractDate(text: string): { date: string | null; rest: string } {
  const lower = trLower(text);
  const relative: [RegExp, number][] = [
    [new RegExp(`(^|[^${L}])(evvelsi gün|önceki gün)(?![${L}])`), -2],
    [new RegExp(`(^|[^${L}])(dün)(?![${L}])`), -1],
    [new RegExp(`(^|[^${L}])(bugün)(?![${L}])`), 0],
  ];
  for (const [re, offset] of relative) {
    const m = lower.match(re);
    if (m && m.index !== undefined) {
      const start = m.index + m[1].length;
      return { date: todayStr(offset), rest: text.slice(0, start) + text.slice(start + m[2].length) };
    }
  }

  // 15.09 / 15.09.2026 / 15/09/26
  let m = text.match(/(^|[^\d.,])(\d{1,2})[./](\d{1,2})(?:[./](\d{4}|\d{2}))?(?![\d])/);
  if (m && m.index !== undefined) {
    const date = buildDate(Number(m[2]), Number(m[3]), m[4] ? Number(m[4]) : undefined);
    if (date) {
      const start = m.index + m[1].length;
      return { date, rest: text.slice(0, start) + text.slice(m.index + m[0].length) };
    }
  }

  // 15 eylül / 15 eylülde / 15 eylül 2026
  m = lower.match(new RegExp(`(^|[^\\d])(\\d{1,2})\\s+(${Object.keys(MONTHS).join('|')})[${L}]*(?:\\s+(\\d{4}))?`));
  if (m && m.index !== undefined) {
    const date = buildDate(Number(m[2]), MONTHS[m[3]], m[4] ? Number(m[4]) : undefined);
    if (date) {
      const start = m.index + m[1].length;
      return { date, rest: text.slice(0, start) + text.slice(m.index + m[0].length) };
    }
  }
  return { date: null, rest: text };
}

interface AmountMatch {
  value: number;
  start: number;
  end: number;
  score: number;
}

function findAmounts(text: string): AmountMatch[] {
  const re = new RegExp(
    `(\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:,(\\d{1,2}))?(?:\\s*(bin|milyon|k)(?![${L}]))?(?:\\s*(tl|₺|lira|try)(?![${L}]))?`,
    'gi'
  );
  const result: AmountMatch[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let value = Number(m[1].replace(/\./g, '') + (m[2] ? '.' + m[2] : ''));
    const mult = m[3] ? trLower(m[3]) : '';
    if (mult === 'bin' || mult === 'k') value *= 1000;
    if (mult === 'milyon') value *= 1000000;
    if (!value) continue;
    result.push({ value, start: m.index, end: m.index + m[0].length, score: (m[4] ? 2 : 0) + (mult ? 1 : 0) });
  }
  return result;
}

function cleanDescription(s: string): string {
  const cleaned = s.replace(/\s+/g, ' ').replace(/^[\s,.;:\-–+]+|[\s,.;:\-–+]+$/g, '').trim();
  if (!cleaned) return '';
  const first = cleaned.charAt(0);
  return (first === 'i' ? 'İ' : first === 'ı' ? 'I' : first.toUpperCase()) + cleaned.slice(1);
}

export function parseChatMessage(text: string): ParsedEntry[] {
  const { date: globalDate, rest } = extractDate(text);
  const messageKind = detectKind(rest);
  const segments = rest.split(/\n|;|,\s+/).map(s => s.trim()).filter(Boolean);

  const entries: ParsedEntry[] = [];
  let pendingDesc = '';
  for (const seg of segments) {
    const segDate = extractDate(seg);
    const segText = segDate.rest;
    const amounts = findAmounts(segText);
    if (amounts.length === 0) {
      // Tutarsız parça: önceki kaydın açıklamasına ekle, yoksa sonrakine taşı
      const last = entries[entries.length - 1];
      if (last) last.description = cleanDescription(`${last.description}, ${segText}`);
      else pendingDesc = `${pendingDesc} ${segText}`;
      continue;
    }
    // En olası tutar: TL/bin ifadesi olan, yoksa en büyüğü
    const best = amounts.reduce((a, b) => (b.score > a.score || (b.score === a.score && b.value > a.value) ? b : a));
    const descRaw = `${pendingDesc} ${segText.slice(0, best.start)} ${segText.slice(best.end)}`;
    pendingDesc = '';
    let kind = detectKind(seg) ?? messageKind;
    // Ortak adı geçiyorsa avanstır (ortak malzeme aldıysa masraf olarak kalır)
    const partner = detectPartner(seg);
    const isAdvance = partner !== null && !mentionsMaterial(seg);
    if (isAdvance) kind = 'advance';
    entries.push({
      kind: kind ?? 'debit',
      amount: Math.round(best.value * 100) / 100,
      description: cleanDescription(descRaw),
      date: segDate.date ?? globalDate ?? todayStr(),
      guessed: kind === null,
      ...(isAdvance ? { partner: partner! } : {}),
    });
  }
  for (const e of entries) if (!e.description) e.description = KIND_LABELS[e.kind];
  return entries;
}

// ===================== BELGE (FİŞ / FATURA / DEKONT) AYRIŞTIRICI =====================
// OCR veya PDF'ten gelen metinden tek bir kayıt önerir: toplam tutar, tarih, firma ve tür.

export interface ParsedDocument extends ParsedEntry {
  docType: 'Fiş' | 'Fatura' | 'Dekont' | 'Teklif' | 'Döküm' | 'Belge';
  candidates: number[]; // kullanıcı seçebilsin diye bulunan diğer tutarlar (büyükten küçüğe)
}

// "1.250,00" / "1250,00" / "1,250.00" / "1250.00" / "1 250,00" / "1250" -> sayı
function parseDocNumber(raw: string): number {
  let s = raw.replace(/\s/g, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // Hangisi sondaysa ondalık ayırıcıdır
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma > -1) {
    s = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
  } else if (lastDot > -1 && !/\.\d{1,2}$/.test(s)) {
    s = s.replace(/\./g, ''); // 1.250 -> binlik ayırıcı
  }
  return Number(s);
}

// OCR düzeltmeleri: "2.300, 00" -> "2.300,00", "1 . 250,00" -> "1.250,00"
function normalizeOcrLine(l: string): string {
  return l
    .replace(/[|]/g, ' ')
    .replace(/(\d)\s*([.,])\s+(\d{2})(?!\d)/g, '$1$2$3')
    .replace(/(\d)\s+([.,])(\d)/g, '$1$2$3')
    .replace(/\s+/g, ' ')
    .trim();
}

const DOC_NUMBER_RE = /\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{1,2})?|\d+[.,]\d{1,2}|\d+/g;

function numbersInLine(line: string): number[] {
  // Tarih, saat ve telefon gibi parçaları tutar sanmamak için ayıkla
  const cleaned = line
    .replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g, ' ')
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, ' ')
    .replace(/%\s*\d+/g, ' ');
  return (cleaned.match(DOC_NUMBER_RE) ?? []).map(parseDocNumber).filter(n => Number.isFinite(n) && n > 0 && n < 100_000_000);
}

// Öncelik sırasıyla toplam satırı anahtar kelimeleri
const TOTAL_KEYS: [RegExp, number][] = [
  [/genel\s*toplam|g\.?\s*toplam/i, 6],
  [/[öo]denecek\s*tutar|[öo]denecek/i, 5],
  [/toplam\s*tutar|tutar\s*toplam/i, 4],
  [/i[sş]lem\s*tutar[ıi]|g[öo]nderilen\s*tutar|havale\s*tutar[ıi]|eft\s*tutar[ıi]/i, 4],
  [/(^|\s)top(lam)?(\s|$|:|\*)/i, 3],
  [/(^|\s)(tutar|total)(\s|$|:)/i, 2],
];

const TOTAL_EXCLUDE = /kdv|vergi|ara\s*toplam|indirim|iskonto|matrah|para\s*üstü|para\s*ustu|nakit\s*verilen/i;

export function parseDocument(text: string): ParsedDocument {
  const lines = text.split(/\r?\n/).map(normalizeOcrLine).filter(Boolean);
  const lower = trLower(text);

  // Tür
  let docType: ParsedDocument['docType'] = 'Belge';
  let kind: EntryKind = 'expense';
  if (/d[öo]k[üu]m|ekstre|hesap\s*[öo]zeti|cari\s*hesap/.test(lower)) {
    // Karışık hesap dökümü: tür satır satır bulunur, varsayılan iş/fatura
    docType = 'Döküm';
    kind = 'debit';
  } else if (/dekont|havale|eft|fast|g[öo]nderen|al[ıi]c[ıi]\s*(ad|iban)|iban/.test(lower)) {
    docType = 'Dekont';
    kind = 'credit';
  } else if (/teklif|proforma/.test(lower)) {
    docType = 'Teklif';
    kind = 'debit';
  } else if (/fatura|e-ar[şs]iv|vkn|vergi\s*no/.test(lower)) {
    docType = 'Fatura';
  } else if (/fi[şs]|z\s*no|ekü|kasa|nakit|kredi\s*kart/.test(lower)) {
    docType = 'Fiş';
  }

  // Tutar: en yüksek öncelikli toplam satırındaki son sayı; yoksa belgedeki en büyük ondalıklı sayı
  let best: { value: number; score: number; index: number } | null = null;
  lines.forEach((line, i) => {
    if (TOTAL_EXCLUDE.test(line)) return;
    for (const [re, score] of TOTAL_KEYS) {
      if (!re.test(line)) continue;
      // Sayı aynı satırda yoksa bir sonraki satıra bak (tablolarda sık görülür)
      let nums = numbersInLine(line);
      if (nums.length === 0 && lines[i + 1]) nums = numbersInLine(lines[i + 1]);
      if (nums.length === 0) continue;
      const value = nums[nums.length - 1];
      // Eşit öncelikte alttaki satır kazanır (toplam genelde en sondadır)
      if (!best || score > best.score || (score === best.score && i >= best.index)) best = { value, score, index: i };
      break;
    }
  });

  const decimals = lines.flatMap(l => (/\d[.,]\d{2}\b/.test(l) ? numbersInLine(l) : []));
  const all = [...new Set([...decimals, ...lines.flatMap(numbersInLine)])].sort((a, b) => b - a);
  const amount = (best as { value: number } | null)?.value ?? decimals.sort((a, b) => b - a)[0] ?? 0;

  // Tarih: ilk geçerli tarih
  let date: string | null = null;
  const dm = text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})\b/);
  if (dm) date = buildDate(Number(dm[1]), Number(dm[2]), Number(dm[3]));
  if (!date) date = extractDate(text).date;

  // Firma / açıklama: harf içeren, anlamlı ilk satır
  const SKIP = /^(fi[şs]|fatura|e-ar[şs]iv|tarih|saat|no|vkn|tckn|vergi|tel|adres|www\.|http|dekont|sayın)/i;
  const vendor =
    lines.find(l => {
      const letters = (l.match(new RegExp(`[${L}]`, 'g')) ?? []).length;
      return letters >= 3 && letters / l.length > 0.5 && !SKIP.test(trLower(l));
    }) ?? '';
  const description = cleanDescription(`${docType === 'Belge' ? '' : docType + ': '}${vendor.slice(0, 60)}`) || docType;

  return {
    kind,
    amount: Math.round(amount * 100) / 100,
    description,
    date: date ?? todayStr(),
    guessed: docType === 'Belge',
    docType,
    candidates: all.slice(0, 8),
  };
}

// ===================== BELGEDEN KALEM KALEM KAYIT =====================
// Her satırı ayrı kayıt olarak önerir; tür satır bazında bulunur (karışık dökümler için).

export interface DocumentItem extends ParsedEntry {
  line: string; // kaynak satır (önizlemede gösterilir)
}

const ITEM_SKIP = /^(tarih|saat|fi[şs]\s*no|fatura\s*(no|tarihi)|belge\s*no|vkn|tckn|vergi|tel|telefon|gsm|adres|iban|www\.|http|e-?posta|mersis|sayın|say[ıi]n|sicil|şube|sube|kasiyer|z\s*no|ekü|eku|banka|hesap\s*no|müşteri\s*no|sayfa)/i;
const ITEM_EXCLUDE = new RegExp(`${TOTAL_EXCLUDE.source}|genel\\s*toplam|toplam|[öo]denecek|bakiye|devir|nakit$|^nakit|kredi\\s*kart|kart\\s*ile|para\\s*üstü|yalnız|yaln[ıi]z|tutar[ıi]?\\s*:?$`, 'i');

// Açıklama: tarihleri, sayıları, para birimlerini ve adet/ölçü ifadelerini temizle
function cleanItemText(s: string): string {
  return cleanDescription(
    s
      .replace(/\b\d{1,2}[./-]\d{1,2}([./-]\d{2,4})?\b/g, ' ')
      .replace(/\b\d+([.,]\d+)?\s*(tl|try|₺|adet|ad|x|kg|gr|lt|l|m2|m²|mt|m|cm|mm|paket|kutu|top|rulo)\b/gi, ' ')
      .replace(DOC_NUMBER_RE, ' ')
      .replace(/\b(tl|try|₺|adet|ad|x|kg|lt|m2|m²|mt|paket|kutu|top)\b/gi, ' ')
      .replace(/[*=:#()%]+/g, ' ')
  );
}

function hasDecimal(raw: string) {
  return /\d[.,]\d{2}(?!\d)/.test(raw);
}

export function parseDocumentItems(text: string): DocumentItem[] {
  const doc = parseDocument(text);
  const lines = text.split(/\r?\n/).map(normalizeOcrLine).filter(Boolean);

  // Belgede tutarlar genelde kuruşlu mu yazılmış? Öyleyse kuruşsuz sayıları (adet, kg, 15LT) tutar sayma
  const decimalLines = lines.filter(hasDecimal).length;
  const useDecimalsOnly = decimalLines >= 2;

  const items: DocumentItem[] = [];
  let pendingDesc = '';

  for (const line of lines) {
    const lower = trLower(line);
    if (ITEM_SKIP.test(lower)) {
      pendingDesc = '';
      continue;
    }
    const letters = (line.match(new RegExp(`[${L}]`, 'g')) ?? []).length;

    // Satırdaki tutar adayları
    const cleaned = line
      .replace(/\b\d{1,2}[./-]\d{1,2}([./-]\d{2,4})?\b/g, ' ')
      .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, ' ')
      .replace(/%\s*\d+/g, ' ');
    const tokens = cleaned.match(DOC_NUMBER_RE) ?? [];
    const amounts = tokens
      .filter(t => (useDecimalsOnly ? hasDecimal(t) : true))
      .map(parseDocNumber)
      .filter(n => Number.isFinite(n) && n >= (useDecimalsOnly ? 0.01 : 10) && n < 100_000_000);

    if (ITEM_EXCLUDE.test(lower)) {
      pendingDesc = '';
      continue;
    }

    if (amounts.length === 0) {
      // Tutarsız açıklama satırı: bir sonraki tutar satırına aktarılır
      if (letters >= 3) pendingDesc = line;
      continue;
    }

    // Fişlerde satır toplamı "*" ile işaretlenir; varsa onu al, yoksa satırdaki son tutar
    const starred = cleaned.match(/\*\s*(\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{1,2})?|\d+[.,]\d{1,2}|\d+)/);
    const starredValue = starred ? parseDocNumber(starred[1]) : NaN;
    const amount = Number.isFinite(starredValue) && starredValue > 0 ? starredValue : amounts[amounts.length - 1];
    // Satır tarihi (ör. dökümlerde "15.09.2026 Salon işçiliği 18.000,00")
    const dm = line.match(/\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{4}|\d{2}))?\b/);
    const lineDate = dm ? buildDate(Number(dm[1]), Number(dm[2]), dm[3] ? Number(dm[3]) : undefined) : null;

    let desc = cleanItemText(line);
    if ((desc.match(new RegExp(`[${L}]`, 'g')) ?? []).length < 3) desc = cleanItemText(pendingDesc);
    else if (pendingDesc && letters < 6) desc = cleanItemText(`${pendingDesc} ${line}`);
    pendingDesc = '';
    if (!desc) continue;

    const kind = detectKind(desc) ?? detectKind(line);
    items.push({
      kind: kind ?? doc.kind,
      amount: Math.round(amount * 100) / 100,
      description: desc.slice(0, 120),
      date: lineDate ?? doc.date,
      guessed: kind === null,
      line,
    });
  }
  return items;
}
