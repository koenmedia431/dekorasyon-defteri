import { useState, type FormEvent } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { supabase, type Transaction, type Expense, type Advance } from '@/lib/supabase';
import { KIND_LABELS, PARTNERS, EXPENSE_CATEGORIES, parseAmountInput, todayStr, type EntryKind } from '@/lib/accounting';
import Modal, { inputClass, labelClass } from './Modal';
import { useConfirm } from './ui';

export type EditableEntry =
  | { kind: 'debit' | 'credit'; row: Transaction }
  | { kind: 'expense'; row: Expense }
  | { kind: 'advance'; row: Advance };

interface Props {
  customerId: string;
  entry?: EditableEntry;     // varsa düzenleme
  initialKind?: EntryKind;   // yeni kayıt için
  initialPartner?: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}

const KIND_STYLE: Record<EntryKind, string> = {
  debit: 'bg-debit-600 border-debit-600',
  credit: 'bg-credit-600 border-credit-600',
  expense: 'bg-expense-500 border-expense-500',
  advance: 'bg-advance-600 border-advance-600',
};

const HINT: Record<EntryKind, string> = {
  debit: 'Müşterinin borcuna eklenir, ekstrede görünür.',
  credit: 'Müşterinin borcundan düşülür, ekstrede görünür.',
  expense: 'Sadece sizin masraf sayfanızda görünür, ekstreye girmez.',
  advance: 'Ortağın bu projeden aldığı para. Müşteri bakiyesini etkilemez, ekstreye girmez.',
};

type Table = 'transactions' | 'expenses' | 'advances';
const tableOf = (k: EntryKind): Table => (k === 'expense' ? 'expenses' : k === 'advance' ? 'advances' : 'transactions');

function entryDate(entry: EditableEntry): string {
  if (entry.kind === 'expense') return entry.row.expense_date;
  if (entry.kind === 'advance') return entry.row.advance_date;
  return entry.row.entry_date;
}

export default function EntryForm({ customerId, entry, initialKind, initialPartner, onClose, onSaved }: Props) {
  const row = entry?.row;
  const [kind, setKind] = useState<EntryKind>(entry?.kind ?? initialKind ?? 'debit');
  const [amount, setAmount] = useState(row ? Number(row.amount).toFixed(2).replace('.', ',') : '');
  const [description, setDescription] = useState(row?.description ?? '');
  const [date, setDate] = useState(entry ? entryDate(entry) : todayStr());
  const [category, setCategory] = useState(entry?.kind === 'expense' ? entry.row.category ?? '' : '');
  const [partner, setPartner] = useState(entry?.kind === 'advance' ? entry.row.partner : initialPartner ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirm = useConfirm();

  // Seçilen türe göre satır verisi
  function rowData(amt: number, desc: string) {
    if (kind === 'expense') return { amount: amt, description: desc, expense_date: date, category: category.trim() || null };
    if (kind === 'advance') return { partner, amount: amt, description: desc, advance_date: date };
    return { entry_type: kind, amount: amt, description: desc, entry_date: date };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const value = parseAmountInput(amount);
    if (!(value > 0)) return setError('Geçerli bir tutar girin');
    if (!date) return setError('Tarih seçin');
    if (kind === 'advance' && !partner) return setError('Avansı alan ortağı seçin');
    setBusy(true);
    setError('');
    const desc = description.trim() || (kind === 'advance' ? `${partner} avans` : KIND_LABELS[kind]);
    const amt = Math.round(value * 100) / 100;
    const data = rowData(amt, desc);
    const target = tableOf(kind);

    let res;
    if (!entry) {
      res = await supabase.from(target).insert({ ...data, customer_id: customerId });
    } else if (tableOf(entry.kind) === target) {
      res = await supabase.from(target).update(data).eq('id', entry.row.id);
    } else {
      // Farklı tabloya taşı (ör. masraf -> avans), sohbet bağlantısı korunur
      res = await supabase.from(target).insert({ ...data, customer_id: customerId, note_id: entry.row.note_id });
      if (!res.error) res = await supabase.from(tableOf(entry.kind)).delete().eq('id', entry.row.id);
    }
    setBusy(false);
    if (res.error) return setError('Kaydedilemedi: ' + res.error.message);
    onSaved(entry ? 'Kayıt güncellendi' : `${KIND_LABELS[kind]} eklendi`);
  }

  async function handleDelete() {
    if (!entry) return;
    const ok = await confirm({ title: 'Kayıt silinsin mi?', message: `"${entry.row.description}" kalıcı olarak silinir.`, confirmText: 'Sil', danger: true });
    if (!ok) return;
    setBusy(true);
    const { error: err } = await supabase.from(tableOf(entry.kind)).delete().eq('id', entry.row.id);
    setBusy(false);
    if (err) return setError('Silinemedi: ' + err.message);
    onSaved('Kayıt silindi');
  }

  return (
    <Modal title={entry ? 'Kaydı Düzenle' : 'Yeni Kayıt'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className={labelClass}>Tür</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(['debit', 'credit', 'expense', 'advance'] as EntryKind[]).map(k => (
              <button
                type="button"
                key={k}
                onClick={() => setKind(k)}
                className={`rounded-lg border px-2 py-2 text-xs font-semibold ${
                  kind === k ? `${KIND_STYLE[k]} text-white` : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {KIND_LABELS[k]}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">{HINT[kind]}</p>
        </div>
        {kind === 'advance' && (
          <div>
            <label className={labelClass}>Avansı alan ortak</label>
            <div className="grid grid-cols-3 gap-2">
              {PARTNERS.map(p => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setPartner(p)}
                  className={`rounded-lg border px-2 py-2 text-sm font-semibold ${
                    partner === p ? 'border-advance-600 bg-advance-600 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Tutar (₺)</label>
            <input autoFocus className={inputClass} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" />
          </div>
          <div>
            <label className={labelClass}>Tarih</label>
            <input className={inputClass} type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Açıklama</label>
          <input
            className={inputClass}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={kind === 'advance' ? 'Örn: Ekim avansı' : 'Örn: Salon boya işçiliği'}
          />
        </div>
        {kind === 'expense' && (
          <div>
            <label className={labelClass}>Kategori</label>
            <div className="flex flex-wrap gap-1.5">
              {EXPENSE_CATEGORIES.map(c => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setCategory(category === c ? '' : c)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${category === c ? 'border-expense-600 bg-expense-600 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Kaydet
        </button>
        {entry && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" /> Kaydı Sil
          </button>
        )}
      </form>
    </Modal>
  );
}
