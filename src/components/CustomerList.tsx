import { useMemo, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import type { CustomerWithBalance } from '@/lib/supabase';
import { formatMoney, balanceLabel } from '@/lib/accounting';
import { href } from '@/lib/router';
import { StatusBadge, STATUS_LABELS, type ProjectStatus } from './ui';

type Filter = 'all' | ProjectStatus;

interface Props {
  customers: CustomerWithBalance[];
  selectedId?: string;
  onAdd: () => void;
}

export default function CustomerList({ customers, selectedId, onAdd }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: customers.length, quote: 0, active: 0, done: 0 };
    customers.forEach(x => c[x.status]++);
    return c;
  }, [customers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR');
    return customers.filter(
      c =>
        (filter === 'all' || c.status === filter) &&
        (!q || c.name.toLocaleLowerCase('tr-TR').includes(q) || (c.phone ?? '').includes(q) || (c.address ?? '').toLocaleLowerCase('tr-TR').includes(q))
    );
  }, [customers, search, filter]);

  const receivable = filtered.reduce((s, c) => s + (c.balance > 0 ? c.balance : 0), 0);

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-slate-200 px-4 pb-3 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Müşteriler</h1>
            <p className="tabular text-xs text-slate-500">
              Alacak: <span className="font-semibold text-debit-700">{formatMoney(receivable)}</span>
            </p>
          </div>
          <button onClick={onAdd} className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">
            <UserPlus className="h-4 w-4" /> Yeni
          </button>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 focus-within:border-debit-400 focus-within:bg-white">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Ad, telefon veya adres ara"
            className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-slate-400"
          />
        </div>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-1 overflow-x-auto px-4 text-xs">
          {(['all', 'active', 'quote', 'done'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`whitespace-nowrap rounded-full px-2.5 py-1 font-medium ${filter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {f === 'all' ? 'Tümü' : STATUS_LABELS[f]} <span className="tabular opacity-60">{counts[f]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-500">
            {customers.length === 0 ? 'Henüz müşteri yok. "Yeni" ile ilk müşterinizi ekleyin.' : 'Eşleşen müşteri yok.'}
          </p>
        ) : (
          filtered.map(c => {
            const tone = c.balance > 0.005 ? 'text-debit-700' : c.balance < -0.005 ? 'text-credit-700' : 'text-slate-400';
            return (
              <a
                key={c.id}
                href={href({ name: 'customers', id: c.id })}
                className={`flex items-center gap-3 border-b border-slate-100 px-4 py-3 hover:bg-slate-50 ${c.id === selectedId ? 'bg-debit-50/60 hover:bg-debit-50' : ''}`}
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                  {c.name.charAt(0).toLocaleUpperCase('tr-TR')}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{c.name}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <StatusBadge status={c.status} />
                    <span className="truncate text-xs text-slate-400">{c.address || c.phone || ''}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`tabular text-sm font-semibold ${tone}`}>{formatMoney(Math.abs(c.balance))}</p>
                  <p className="text-[10px] text-slate-400">{balanceLabel(c.balance)}</p>
                </div>
              </a>
            );
          })
        )}
      </div>
    </div>
  );
}
