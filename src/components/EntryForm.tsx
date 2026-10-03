import { useState, type FormEvent } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { supabase, type Transaction, type Expense } from '@/lib/supabase';
import { KIND_LABELS, parseAmountInput, todayStr, type EntryKind } from '@/lib/accounting';
import Modal, { inputClass, labelClass } from './Modal';

export type EditableEntry = { kind: 'debit' | 'credit'; row: Transaction } | { kind: 'expense'; row: Expense };

interface Props {
  customerId: string;
  entry?: EditableEntry;     // varsa düzenleme
  initialKind?: EntryKind;   // yeni kayıt için
  onClose: () => void;
  onSaved: () => void;
}

const KIND_STYLE: Record<EntryKind, string> = {
  debit: 'bg-rose-600 border-rose-600',
  credit: 'bg-emerald-600 border-emerald-600',
  expense: 'bg-amber-500 border-amber-500',
};

const HINT: Record<EntryKind, string> = {
  debit: 'Müşterinin borcuna eklenir, ekstrede görünür.',
  credit: 'Müşterinin borcundan düşülür, ekstrede görünür.',
  expense: 'Sadece sizin masraf sayfanızda görünür, ekstreye girmez.',
};

export default function EntryForm({ customerId, entry, initialKind, onClose, onSaved }: Props) {
  const row = entry?.row;
  const [kind, setKind] = useState<EntryKind>(entry?.kind ?? initialKind ?? 'debit');
  const [amount, setAmount] = useState(row ? String(row.amount).replace('.', ',') : '');
  const [description, setDescription] = useState(row?.description ?? '');
  const [date, setDate] = useState(
    entry ? (entry.kind === 'expense' ? entry.row.expense_date : entry.row.entry_date) : todayStr()
  );
  const [category, setCategory] = useState(entry?.kind === 'expense' ? entry.row.category ?? '' : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const value = parseAmountInput(amount);
    if (!(value > 0)) return setError('Geçerli bir tutar girin');
    if (!date) return setError('Tarih seçin');
    setBusy(true);
    setError('');
    const desc = description.trim() || KIND_LABELS[kind];
    const noteId = row?.note_id ?? null;
    const amt = Math.round(value * 100) / 100;

    const insertNew = () =>
      kind === 'expense'
        ? supabase.from('expenses').insert({ customer_id: customerId, amount: amt, description: desc, expense_date: date, category: category.trim() || null, note_id: noteId })
        : supabase.from('transactions').insert({ customer_id: customerId, entry_type: kind, amount: amt, description: desc, entry_date: date, note_id: noteId });

    let res;
    if (!entry) res = await insertNew();
    else if ((entry.kind === 'expense') === (kind === 'expense')) {
      // Aynı tabloda güncelle
      res =
        kind === 'expense'
          ? await supabase.from('expenses').update({ amount: amt, description: desc, expense_date: date, category: category.trim() || null }).eq('id', entry.row.id)
          : await supabase.from('transactions').update({ entry_type: kind, amount: amt, description: desc, entry_date: date }).eq('id', entry.row.id);
    } else {
      // Masraf <-> hesap hareketi arasında taşı
      res = await insertNew();
      if (!res.error) res = await supabase.from(entry.kind === 'expense' ? 'expenses' : 'transactions').delete().eq('id', entry.row.id);
    }
    setBusy(false);
    if (res.error) return setError('Kaydedilemedi: ' + res.error.message);
    onSaved();
  }

  async function handleDelete() {
    if (!entry || !confirm(`"${entry.row.description}" silinsin mi?`)) return;
    setBusy(true);
    const { error: err } = await supabase.from(entry.kind === 'expense' ? 'expenses' : 'transactions').delete().eq('id', entry.row.id);
    setBusy(false);
    if (err) return setError('Silinemedi: ' + err.message);
    onSaved();
  }

  return (
    <Modal title={entry ? 'Kaydı Düzenle' : 'Yeni Kayıt'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className={labelClass}>Tür</label>
          <div className="grid grid-cols-3 gap-2">
            {(['debit', 'credit', 'expense'] as EntryKind[]).map(k => (
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
          <input className={inputClass} value={description} onChange={e => setDescription(e.target.value)} placeholder="Örn: Salon boya işçiliği" />
        </div>
        {kind === 'expense' && (
          <div>
            <label className={labelClass}>Kategori (isteğe bağlı)</label>
            <input className={inputClass} list="expense-categories" value={category} onChange={e => setCategory(e.target.value)} />
            <datalist id="expense-categories">
              {['Malzeme', 'İşçilik / Usta', 'Nakliye', 'Yakıt', 'Yemek', 'Diğer'].map(c => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        )}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
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
