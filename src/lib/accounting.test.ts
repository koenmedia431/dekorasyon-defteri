import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChatMessage, formatMoney, parseAmountInput, buildStatement, balanceOf, todayStr } from './accounting.ts';

const one = (text: string) => {
  const r = parseChatMessage(text);
  assert.equal(r.length, 1, `tek kayıt bekleniyordu: ${JSON.stringify(r)}`);
  return r[0];
};

test('iş / fatura borç olarak yazılır', () => {
  const e = one('Salon boyası işçilik 18.000 TL');
  assert.equal(e.kind, 'debit');
  assert.equal(e.amount, 18000);
  assert.equal(e.description, 'Salon boyası işçilik');
  // Ek alan hâller (ünsüz yumuşaması)
  assert.equal(one('Salon boya işçiliği 18.000').kind, 'debit');
  assert.equal(one('mutfak faturası 9500').kind, 'debit');
  assert.equal(one('ikinci hakedişi 30 bin').kind, 'debit');
});

test('kapora ve ödeme tahsilat olur', () => {
  assert.equal(one('Ayşe hanım 10 bin kapora verdi').kind, 'credit');
  assert.equal(one('Ayşe hanım 10 bin kapora verdi').amount, 10000);
  assert.equal(one('havale geldi 25000').kind, 'credit');
  assert.equal(one('müşteri 7500 ödedi').kind, 'credit');
});

test('malzeme ve usta masraf olur', () => {
  assert.equal(one('boya aldım 3.250,50').kind, 'expense');
  assert.equal(one('boya aldım 3.250,50').amount, 3250.5);
  assert.equal(one('ustaya 1500 verdik').kind, 'expense');
  assert.equal(one('duvar kağıdı aldım 4200').kind, 'expense');
  assert.equal(one('işçi yevmiyesi 1500').kind, 'expense');
  assert.equal(one('salon işi 15000').kind, 'debit');
});

test('birden fazla kayıt ve tarih', () => {
  const r = parseChatMessage('dün mutfak tadilatı 40000, malzeme 12000');
  assert.equal(r.length, 2);
  assert.deepEqual(r.map(e => e.kind), ['debit', 'expense']);
  assert.ok(r.every(e => e.date === todayStr(-1)));
  const d = one('15.09 banyo seramik işi 22.000');
  assert.equal(d.date.slice(5), '09-15');
  assert.equal(d.kind, 'debit');
});

test('tutar yoksa kayıt çıkmaz, bilinmeyen tür tahmin edilir', () => {
  assert.equal(parseChatMessage('yarın keşfe gidilecek').length, 0);
  const e = one('Mehmet bey 5000');
  assert.equal(e.kind, 'debit');
  assert.equal(e.guessed, true);
});

test('biçimlendirme', () => {
  assert.equal(formatMoney(1234567.5), '1.234.567,50 ₺');
  assert.equal(parseAmountInput('12.500,50'), 12500.5);
  assert.equal(parseAmountInput('12.500'), 12500);
});

test('ekstre: devir ve yürüyen bakiye', () => {
  const mk = (id: string, t: 'debit' | 'credit', amount: number, date: string) => ({
    id, entry_type: t, amount, description: id, entry_date: date, created_at: date,
  });
  const entries = [mk('a', 'debit', 10000, '2026-08-01'), mk('b', 'credit', 4000, '2026-08-10'), mk('c', 'debit', 5000, '2026-09-05')];
  const st = buildStatement(entries, '2026-09-01', '2026-09-30');
  assert.equal(st.opening, 6000);
  assert.equal(st.rows.length, 1);
  assert.equal(st.closing, 11000);
  assert.equal(balanceOf(entries), 11000);
});

import { parseDocument } from './accounting.ts';

test('belge: market / nalbur fişi', () => {
  const d = parseDocument(`KOÇTAŞ YAPI MARKETLERİ
KADIKÖY ŞUBESİ
TARİH: 21.09.2026 SAAT: 14:32
FİŞ NO: 0042
PLASTİK BOYA 15LT      2 X 1.150,00
              *2.300,00
FIRÇA SETİ             *185,50
ARA TOPLAM             *2.485,50
KDV %20                *414,25
TOPLAM                 *2.485,50
NAKİT                  *2.500,00
PARA ÜSTÜ              *14,50`);
  assert.equal(d.amount, 2485.5);
  assert.equal(d.date, '2026-09-21');
  assert.equal(d.kind, 'expense');
  assert.equal(d.docType, 'Fiş');
  assert.match(d.description, /KOÇTAŞ/);
});

test('belge: e-arşiv fatura (ödenecek tutar)', () => {
  const d = parseDocument(`e-Arşiv Fatura
Yıldız Alçı ve Yapı Malzemeleri Ltd. Şti.
VKN: 1234567890
Fatura Tarihi: 02/10/2026
Mal Hizmet Toplam Tutarı 10.000,00 TL
Hesaplanan KDV (%20) 2.000,00 TL
Vergiler Dahil Toplam Tutar 12.000,00 TL
Ödenecek Tutar 12.000,00 TL`);
  assert.equal(d.amount, 12000);
  assert.equal(d.date, '2026-10-02');
  assert.equal(d.docType, 'Fatura');
  assert.equal(d.kind, 'expense');
  assert.match(d.description, /Yıldız Alçı/);
});

test('belge: banka dekontu tahsilat olur', () => {
  const d = parseDocument(`XYZ BANKASI
HAVALE / EFT DEKONTU
İşlem Tarihi 03.10.2026
Gönderen: AYŞE YILMAZ
Alıcı Adı: MEHMET DEKORASYON
IBAN: TR12 0001 0000 0000 0000 0000 01
İşlem Tutarı: 15.000,00 TL
Açıklama: kapora`);
  assert.equal(d.amount, 15000);
  assert.equal(d.kind, 'credit');
  assert.equal(d.docType, 'Dekont');
  assert.equal(d.date, '2026-10-03');
});

test('belge: tutar sonraki satırda ve İngilizce biçim', () => {
  const d = parseDocument(`Teklif Formu
Mutfak dolabı montaj
GENEL TOPLAM
45,000.00`);
  assert.equal(d.amount, 45000);
  assert.equal(d.kind, 'debit');
});

import { parseDocumentItems } from './accounting.ts';

test('kalemler: karışık hesap dökümü, her satır kendi türünde', () => {
  const items = parseDocumentItems(`AYŞE YILMAZ - HESAP DÖKÜMÜ
15.09.2026 Salon boya işçiliği 18.000,00
16.09.2026 Mutfak tadilatı 40.000,00
18.09.2026 Kapora alındı 10.000,00
20.09.2026 Boya alındı 3.250,00
21.09.2026 Usta yevmiyesi 1.500,00
22.09.2026 Havale geldi 25.000,00
GENEL TOPLAM 51.250,00`);
  assert.deepEqual(
    items.map(i => [i.kind, i.amount, i.date]),
    [
      ['debit', 18000, '2026-09-15'],
      ['debit', 40000, '2026-09-16'],
      ['credit', 10000, '2026-09-18'],
      ['expense', 3250, '2026-09-20'],
      ['expense', 1500, '2026-09-21'],
      ['credit', 25000, '2026-09-22'],
    ]
  );
  assert.equal(items[0].description, 'Salon boya işçiliği');
  assert.equal(parseDocument('AYŞE YILMAZ - HESAP DÖKÜMÜ\nHavale geldi 25.000,00').docType, 'Döküm');
});

test('kalemler: fiş satırları, KDV / toplam / nakit atlanır', () => {
  const items = parseDocumentItems(`KOÇTAŞ YAPI MARKETLERİ
TARİH: 21.09.2026 SAAT: 14:32
FİŞ NO: 0042
PLASTİK BOYA 15LT
2 X 1.150,00 *2.300,00
FIRÇA SETİ *185,50
KDV %20 *414,25
TOPLAM *2.485,50
NAKİT *2.500,00
PARA ÜSTÜ *14,50`);
  assert.deepEqual(items.map(i => [i.description, i.amount, i.kind]), [
    ['PLASTİK BOYA', 2300, 'expense'],
    ['FIRÇA SETİ', 185.5, 'expense'],
  ]);
  assert.ok(items.every(i => i.date === '2026-09-21'));
});

test('kalemler: fatura tablosu satırları', () => {
  const items = parseDocumentItems(`e-Arşiv Fatura
Yıldız Alçı ve Yapı Malzemeleri Ltd. Şti.
Fatura Tarihi: 02/10/2026
Saten alçı 25 kg 40 8.000,00 TL
Köşe profili 100 2.000,00 TL
Mal Hizmet Toplam Tutarı 10.000,00 TL
Hesaplanan KDV (%20) 2.000,00 TL
Ödenecek Tutar 12.000,00 TL`);
  assert.deepEqual(items.map(i => [i.description, i.amount, i.kind, i.date]), [
    ['Saten alçı', 8000, 'expense', '2026-10-02'],
    ['Köşe profili', 2000, 'expense', '2026-10-02'],
  ]);
});

test('kalemler: OCR boşluklu tutar ve yıldızlı satır toplamı', () => {
  const items = parseDocumentItems(`KOÇTAŞ YAPI MARKETLERİ
TARİH: 21.09.2026 SAAT: 14:32
PLASTİK BOYA 15LT
2 X 1.150,00 *2.300, 00
FIRÇA SETİ *185,50
KDV 420 *414,25
TOPLAM *2.485,50`);
  assert.deepEqual(items.map(i => [i.description, i.amount]), [
    ['PLASTİK BOYA', 2300],
    ['FIRÇA SETİ', 185.5],
  ]);
});
