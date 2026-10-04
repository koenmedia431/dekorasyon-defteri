import { useMemo, useState } from 'react';
import { Search, UserPlus, Users, LogOut, HandCoins } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatMoney, balanceLabel } from '@/lib/accounting';
import type { CustomerWithBalance } from '@/App';
import CustomerForm from './CustomerForm';

interface Props {
  customers: CustomerWithBalance[];
  selectedId: string | null;
  userEmail: string;
  onSelect: (id: string) => void;
  onCustomerAdded: (id?: string) => void;
  onShowAdvances: () => void;
  advancesActive: boolean;
}

export default function CustomerSidebar({ customers, selectedId, userEmail, onSelect, onCustomerAdded, onShowAdvances, advancesActive }: Props) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR');
    if (!q) return customers;
    return customers.filter(c => c.name.toLocaleLowerCase('tr-TR').includes(q) || (c.phone ?? '').includes(q));
  }, [customers, search]);

  const receivable = customers.reduce((s, c) => s + (c.balance > 0 ? c.balance : 0), 0);

  return (
    <div className="flex h-full flex-col bg-slate-900 text-slate-100">
      <div className="border-b border-slate-700 p-4">
        <div className="mb-3 flex items-center gap-2 pr-10 lg:pr-0">
          <Users className="h-5 w-5 text-sky-400" />
          <h1 className="text-lg font-bold">Müşteri Defteri</h1>
        </div>
        <div className="mb-3 rounded-lg bg-slate-800 px-3 py-2">
          <p className="text-xs text-slate-400">Toplam alacak</p>
          <p className="text-lg font-bold text-amber-300">{formatMoney(receivable)}</p>
        </div>
        <button
          onClick={onShowAdvances}
          className={`mb-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
            advancesActive ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <HandCoins className="h-4 w-4" /> Ortak Avansları
        </button>
        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg bg-slate-800 px-3">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Müşteri ara..."
              className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-slate-500"
            />
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-sky-600 px-3 text-white hover:bg-sky-500"
            title="Yeni müşteri"
            aria-label="Yeni müşteri"
          >
            <UserPlus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">
            {search ? 'Eşleşen müşteri yok' : 'Henüz müşteri yok. Sağ üstteki butonla ekleyin.'}
          </p>
        ) : (
          filtered.map(c => {
            const color = c.balance > 0.005 ? 'text-amber-300' : c.balance < -0.005 ? 'text-emerald-400' : 'text-slate-500';
            return (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={`flex w-full items-center gap-3 border-b border-slate-800 px-4 py-3 text-left hover:bg-slate-800 ${
                  c.id === selectedId && !advancesActive ? 'bg-slate-800' : ''
                }`}
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-sky-900 text-sm font-bold text-sky-300">
                  {c.name.charAt(0).toLocaleUpperCase('tr-TR')}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="truncate text-xs text-slate-500">{c.phone || c.address || '—'}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${color}`}>{formatMoney(Math.abs(c.balance))}</p>
                  <p className={`text-[10px] ${color}`}>{balanceLabel(c.balance)}</p>
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between border-t border-slate-700 px-4 py-3 text-xs text-slate-500">
        <span className="truncate">{userEmail}</span>
        <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-1 hover:text-white" title="Çıkış">
          <LogOut className="h-4 w-4" /> Çıkış
        </button>
      </div>

      {showForm && (
        <CustomerForm
          onClose={() => setShowForm(false)}
          onSaved={id => {
            setShowForm(false);
            onCustomerAdded(id);
          }}
        />
      )}
    </div>
  );
}
