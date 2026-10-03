// Para/tarih biçimlendirme, ekstre hesabı ve sohbet ayrıştırıcısı.
// Saf fonksiyonlar; Supabase'e bağımlı değil (testler node ile çalışır).

export type EntryKind = 'debit' | 'credit' | 'expense';

export const KIND_LABELS: Record<EntryKind, string> = {
  debit: 'İş / Fatura',
  credit: 'Tahsilat',
  expense: 'Masraf',
};

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
    const kind = detectKind(seg) ?? messageKind;
    entries.push({
      kind: kind ?? 'debit',
      amount: Math.round(best.value * 100) / 100,
      description: cleanDescription(descRaw),
      date: segDate.date ?? globalDate ?? todayStr(),
      guessed: kind === null,
    });
  }
  for (const e of entries) if (!e.description) e.description = KIND_LABELS[e.kind];
  return entries;
}
