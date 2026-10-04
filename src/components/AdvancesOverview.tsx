import { useEffect, useMemo, useState } from 'react';
import { HandCoins, Loader2 } from 'lucide-react';
import { supabase, type Advance, type Customer } from '@/lib/supabase';
import { formatMoney, formatDate, PARTNERS } from '@/lib/accounting';

interface Props {
  customers: Customer[];
  onOpenCustomer: (id: string) => void;
}

type Period = 'all' | 'thisMonth' | 'thisYear';

// Tüm projeler: hangi ortak hangi projeden ne kadar avans aldı
export default function AdvancesOverview({ customers, onOpenCustomer }: Props) {
  const [advances, setAdvances] = useState<Advance[] | null>(null);
  const [period, setPeriod] = useState<Period>('all');

  useEffect(() => {
    supabase
      .from('advances')
      .select('*')
      .order('advance_date', { ascending: false })
      .then(({ data }) => setAdvances(((data || []) as Advance[]).map(a => ({ ...a, amount: Number(a.amount) }))));
  }, []);

  const filtered = useMemo(() => {
    if (!advances) return [];
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (period === 'thisMonth') return advances.filter(a => a.advance_date.startsWith(ym));
    if (period === 'thisYear') return advances.filter(a => a.advance_date.startsWith(String(now.getFullYear())));
    return advances;
  }, [advances, period]);

  // Ortak listesi: sabit ortaklar + kayıtlarda geçen diğer isimler
  const partners = useMemo(() => [...new Set([...PARTNERS, ...filtered.map(a => a.partner)])], [filtered]);
  const names = new Map(customers.map(c => [c.id, c.name]));

  const matrix = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    filtered.forEach(a => {
      if (!m.has(a.customer_id)) m.set(a.customer_id, new Map());
      const row = m.get(a.customer_id)!;
      row.set(a.partner, (row.get(a.partner) || 0) + a.amount);
    });
    return [...m].sort((x, y) => (names.get(x[0]) ?? '').localeCompare(names.get(y[0]) ?? '', 'tr'));
  }, [filtered, names]);

  const partnerTotal = (p: string) => filtered.filter(a => a.partner === p).reduce((s, a) => s + a.amount, 0);
  const grand = filtered.reduce((s, a) => s + a.amount, 0);

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800">
          <HandCoins className="h-5 w-5 text-violet-600" /> Ortak Avansları
        </h2>
        <div className="flex gap-1.5">
          {([
            ['all', 'Tümü'],
            ['thisYear', 'Bu Yıl'],
            ['thisMonth', 'Bu Ay'],
          ] as [Period, string][]).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setPeriod(k)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${period === k ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-300 bg-white text-slate-600'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {advances === null ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {partners.map(p => (
              <div key={p} className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold text-slate-500">{p}</p>
                <p className="whitespace-nowrap text-base font-bold text-violet-700">{formatMoney(partnerTotal(p))}</p>
              </div>
            ))}
            <div className="rounded-xl bg-violet-600 p-3 text-white">
              <p className="text-xs font-semibold text-violet-100">Toplam</p>
              <p className="whitespace-nowrap text-base font-bold">{formatMoney(grand)}</p>
            </div>
          </div>

          {matrix.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">Bu dönemde avans kaydı yok.</p>
          ) : (
            <>
              <h3 className="mb-2 text-sm font-semibold text-slate-600">Proje bazında</h3>
              <div className="mb-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Proje / Müşteri</th>
                      {partners.map(p => (
                        <th key={p} className="px-3 py-2 text-right font-semibold">{p}</th>
                      ))}
                      <th className="px-3 py-2 text-right font-semibold">Toplam</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.map(([cid, row]) => (
                      <tr key={cid} onClick={() => onOpenCustomer(cid)} className="cursor-pointer border-t border-slate-100 hover:bg-violet-50">
                        <td className="px-3 py-2 font-medium text-slate-700">{names.get(cid) ?? 'Silinmiş müşteri'}</td>
                        {partners.map(p => (
                          <td key={p} className="whitespace-nowrap px-3 py-2 text-right text-slate-600">{row.get(p) ? formatMoney(row.get(p)!) : '—'}</td>
                        ))}
                        <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-violet-700">
                          {formatMoney([...row.values()].reduce((s, v) => s + v, 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                    <tr>
                      <td className="px-3 py-2 text-slate-700">Toplam</td>
                      {partners.map(p => (
                        <td key={p} className="whitespace-nowrap px-3 py-2 text-right text-violet-700">{formatMoney(partnerTotal(p))}</td>
                      ))}
                      <td className="whitespace-nowrap px-3 py-2 text-right text-violet-800">{formatMoney(grand)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <h3 className="mb-2 text-sm font-semibold text-slate-600">Son avanslar</h3>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                {filtered.slice(0, 50).map(a => (
                  <button key={a.id} onClick={() => onOpenCustomer(a.customer_id)} className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-left last:border-0 hover:bg-violet-50">
                    <span className="w-16 flex-shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-center text-xs font-semibold text-violet-700">{a.partner}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-700">{names.get(a.customer_id) ?? '—'} · {a.description}</p>
                      <p className="text-xs text-slate-400">{formatDate(a.advance_date)}</p>
                    </div>
                    <span className="whitespace-nowrap text-sm font-bold text-violet-700">{formatMoney(a.amount)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
