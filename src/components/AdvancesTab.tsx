import { Plus, Lock } from 'lucide-react';
import type { Advance } from '@/lib/supabase';
import { formatMoney, formatDate, PARTNERS } from '@/lib/accounting';

interface Props {
  advances: Advance[];
  profit: number; // iş − masraf
  onEdit: (a: Advance) => void;
  onAdd: (partner?: string) => void;
}

// Bu projeden hangi ortağın ne kadar avans aldığı
export default function AdvancesTab({ advances, profit, onEdit, onAdd }: Props) {
  const byPartner = new Map<string, number>();
  PARTNERS.forEach(p => byPartner.set(p, 0));
  advances.forEach(a => byPartner.set(a.partner, (byPartner.get(a.partner) || 0) + a.amount));
  const total = advances.reduce((s, a) => s + a.amount, 0);
  const remaining = profit - total;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <p className="mb-3 flex items-center gap-1 text-xs text-slate-500">
          <Lock className="h-3 w-3" /> Ortakların bu projeden aldığı avanslar. Müşteri bakiyesini etkilemez, ekstreye girmez.
        </p>

        <div className="mb-4 grid grid-cols-3 gap-2">
          {[...byPartner].map(([partner, sum]) => (
            <button
              key={partner}
              onClick={() => onAdd(partner)}
              className="rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-violet-300 hover:bg-violet-50"
              title={`${partner} için avans ekle`}
            >
              <p className="text-xs font-semibold text-slate-500">{partner}</p>
              <p className="mt-0.5 whitespace-nowrap text-sm font-bold text-violet-700 sm:text-base">{formatMoney(sum)}</p>
              <p className="text-[10px] text-slate-400">{total > 0 ? `%${((sum / total) * 100).toFixed(0)}` : '—'}</p>
            </button>
          ))}
        </div>

        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex justify-between py-1 text-sm">
            <span className="text-slate-500">Proje kârı (iş − masraf)</span>
            <span className="font-semibold">{formatMoney(profit)}</span>
          </div>
          <div className="flex justify-between py-1 text-sm">
            <span className="text-slate-500">Ortaklara verilen avans</span>
            <span className="font-semibold text-violet-700">− {formatMoney(total)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-slate-100 pt-2">
            <span className="font-semibold text-slate-700">Kalan</span>
            <span className={`font-bold ${remaining >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatMoney(remaining)}</span>
          </div>
        </div>

        {advances.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            Henüz avans yok. Yukarıdaki ortak kartına dokunun ya da sohbete "Cihad 5000 avans aldı" yazın.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {advances.map(a => (
              <button key={a.id} onClick={() => onEdit(a)} className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-left last:border-0 hover:bg-violet-50">
                <span className="w-16 flex-shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-center text-xs font-semibold text-violet-700">{a.partner}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-700">{a.description}</p>
                  <p className="text-xs text-slate-400">{formatDate(a.advance_date)}</p>
                </div>
                <span className="whitespace-nowrap text-sm font-bold text-violet-700">{formatMoney(a.amount)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="no-print border-t border-slate-200 bg-white p-3">
        <button onClick={() => onAdd()} className="flex w-full items-center justify-center gap-1 rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">
          <Plus className="h-4 w-4" /> Avans Ekle
        </button>
      </div>
    </div>
  );
}
