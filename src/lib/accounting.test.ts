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
