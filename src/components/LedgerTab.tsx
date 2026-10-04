import { Plus } from 'lucide-react';
import type { Transaction } from '@/lib/supabase';
import { formatMoney, formatDate, buildStatement, type EntryKind } from '@/lib/accounting';

interface Props {
  transactions: Transaction[];
  onEdit: (t: Transaction) => void;
  onAdd: (kind: EntryKind) => void;
}

// Müşteri hesabı: tüm iş/fatura ve tahsilatlar, yürüyen bakiyeyle (yeniden eskiye)
export default function LedgerTab({ transactions, onEdit, onAdd }: Props) {
  const rows = buildStatement(transactions).rows.reverse();
  const byId = new Map(transactions.map(t => [t.id, t]));

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">Henüz hesap hareketi yok.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Tarih</th>
                  <th className="px-3 py-2 text-left font-semibold">Açıklama</th>
                  <th className="px-3 py-2 text-right font-semibold">Borç</th>
                  <th className="px-3 py-2 text-right font-semibold">Ödeme</th>
                  <th className="hidden px-3 py-2 text-right font-semibold sm:table-cell">Bakiye</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ entry, balance }) => (
                  <tr key={entry.id} onClick={() => onEdit(byId.get(entry.id)!)} className="cursor-pointer border-t border-slate-100 hover:bg-debit-50">
                    <td className="whitespace-nowrap px-3 py-2 text-slate-500">{formatDate(entry.entry_date)}</td>
                    <td className="px-3 py-2 text-slate-700">{entry.description}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-debit-600">
                      {entry.entry_type === 'debit' ? formatMoney(entry.amount) : ''}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-credit-600">
                      {entry.entry_type === 'credit' ? formatMoney(entry.amount) : ''}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-2 text-right text-slate-600 sm:table-cell">{formatMoney(balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="no-print flex gap-2 border-t border-slate-200 bg-white p-3">
        <button onClick={() => onAdd('debit')} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-debit-600 py-2.5 text-sm font-semibold text-white hover:bg-debit-700">
          <Plus className="h-4 w-4" /> İş / Fatura
        </button>
        <button onClick={() => onAdd('credit')} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-credit-600 py-2.5 text-sm font-semibold text-white hover:bg-credit-700">
          <Plus className="h-4 w-4" /> Tahsilat
        </button>
      </div>
    </div>
  );
}
