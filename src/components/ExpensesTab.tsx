import { Plus, Lock } from 'lucide-react';
import type { Expense } from '@/lib/supabase';
import { formatMoney, formatDate } from '@/lib/accounting';

interface Props {
  expenses: Expense[];
  totalDebit: number;
  onEdit: (e: Expense) => void;
  onAdd: () => void;
}

// Bizim iç sayfamız: bu müşteri için yapılan masraflar ve kâr; müşteriye gösterilmez
export default function ExpensesTab({ expenses, totalDebit, onEdit, onAdd }: Props) {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const profit = totalDebit - total;
  const byCategory = new Map<string, number>();
  expenses.forEach(e => byCategory.set(e.category || 'Diğer', (byCategory.get(e.category || 'Diğer') || 0) + e.amount));

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <p className="mb-3 flex items-center gap-1 text-xs text-slate-500">
          <Lock className="h-3 w-3" /> Bu sayfa sadece size özel, ekstreye girmez.
        </p>
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex justify-between py-1 text-sm">
            <span className="text-slate-500">İş / fatura toplamı</span>
            <span className="font-semibold">{formatMoney(totalDebit)}</span>
          </div>
          <div className="flex justify-between py-1 text-sm">
            <span className="text-slate-500">Masraf toplamı</span>
            <span className="font-semibold text-amber-600">− {formatMoney(total)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-slate-100 pt-2">
            <span className="font-semibold text-slate-700">Kâr</span>
            <span className={`font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatMoney(profit)}
              {totalDebit > 0 && <span className="ml-1 text-xs font-medium">(%{((profit / totalDebit) * 100).toFixed(0)})</span>}
            </span>
          </div>
          {byCategory.size > 1 && (
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
              {[...byCategory].map(([cat, sum]) => (
                <span key={cat} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-700">
                  {cat}: {formatMoney(sum)}
                </span>
              ))}
            </div>
          )}
        </div>

        {expenses.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            Masraf kaydı yok. Sohbete "boya aldım 2500" veya "usta yevmiyesi 1500" yazabilirsiniz.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {expenses.map(e => (
              <button key={e.id} onClick={() => onEdit(e)} className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-left last:border-0 hover:bg-amber-50">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-700">{e.description}</p>
                  <p className="text-xs text-slate-400">
                    {formatDate(e.expense_date)}
                    {e.category ? ` · ${e.category}` : ''}
                  </p>
                </div>
                <span className="text-sm font-bold text-amber-600">{formatMoney(e.amount)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="no-print border-t border-slate-200 bg-white p-3">
        <button onClick={onAdd} className="flex w-full items-center justify-center gap-1 rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-white hover:bg-amber-600">
          <Plus className="h-4 w-4" /> Masraf Ekle
        </button>
      </div>
    </div>
  );
}
