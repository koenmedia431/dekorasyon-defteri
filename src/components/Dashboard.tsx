import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Building2, CalendarClock, Plus, UserPlus, Settings } from 'lucide-react';
import { supabase, type CustomerWithBalance } from '@/lib/supabase';
import { formatMoney, formatDate, KIND_LABELS, type EntryKind } from '@/lib/accounting';
import { href } from '@/lib/router';
import { useSettings } from '@/lib/settings';
import MonthlyChart, { type MonthPoint } from './MonthlyChart';
import { StatCard } from './ui';

interface Row {
  id: string;
  customer_id: string;
  kind: EntryKind;
  amount: number;
  date: string;
  description: string;
  created_at: string;
}

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const KIND_BADGE: Record<EntryKind, string> = {
  debit: 'bg-debit-50 text-debit-700',
  credit: 'bg-credit-50 text-credit-700',
  expense: 'bg-expense-50 text-expense-700',
  advance: 'bg-advance-50 text-advance-700',
};

const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export default function Dashboard({ customers, onAddCustomer }: { customers: CustomerWithBalance[]; onAddCustomer: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const { settings } = useSettings();

  useEffect(() => {
    Promise.all([
      supabase.from('transactions').select('id, customer_id, entry_type, amount, entry_date, description, created_at'),
      supabase.from('expenses').select('id, customer_id, amount, expense_date, description, created_at'),
      supabase.from('advances').select('id, customer_id, amount, advance_date, description, partner, created_at'),
    ]).then(([tx, exp, adv]) => {
      const all: Row[] = [
        ...(tx.data ?? []).map(t => ({ id: t.id, customer_id: t.customer_id, kind: t.entry_type as EntryKind, amount: Number(t.amount), date: t.entry_date, description: t.description, created_at: t.created_at })),
        ...(exp.data ?? []).map(e => ({ id: e.id, customer_id: e.customer_id, kind: 'expense' as EntryKind, amount: Number(e.amount), date: e.expense_date, description: e.description, created_at: e.created_at })),
        ...(adv.data ?? []).map(a => ({ id: a.id, customer_id: a.customer_id, kind: 'advance' as EntryKind, amount: Number(a.amount), date: a.advance_date, description: `${a.partner} · ${a.description}`, created_at: a.created_at })),
      ];
      setRows(all);
    });
  }, []);

  const names = useMemo(() => new Map(customers.map(c => [c.id, c.name])), [customers]);

  const stats = useMemo(() => {
    const now = new Date();
    const thisM = ym(now);
    const lastM = ym(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const sum = (m: string, k: EntryKind) => (rows ?? []).filter(r => r.kind === k && r.date.startsWith(m)).reduce((s, r) => s + r.amount, 0);
    const months: MonthPoint[] = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const k = ym(d);
      return { key: k, label: MONTHS[d.getMonth()].slice(0, 3), fullLabel: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, debit: sum(k, 'debit'), credit: sum(k, 'credit'), expense: sum(k, 'expense') };
    });
    return {
      receivable: customers.reduce((s, c) => s + (c.balance > 0 ? c.balance : 0), 0),
      debit: sum(thisM, 'debit'),
      credit: sum(thisM, 'credit'),
      expense: sum(thisM, 'expense'),
      lastDebit: sum(lastM, 'debit'),
      lastCredit: sum(lastM, 'credit'),
      lastExpense: sum(lastM, 'expense'),
      months,
    };
  }, [rows, customers]);

  const activeProjects = useMemo(
    () =>
      customers
        .filter(c => c.status === 'active')
        .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
        .slice(0, 6),
    [customers]
  );
  const billedBy = useMemo(() => {
    const m = new Map<string, number>();
    (rows ?? []).filter(r => r.kind === 'debit').forEach(r => m.set(r.customer_id, (m.get(r.customer_id) || 0) + r.amount));
    return m;
  }, [rows]);
  const debtors = useMemo(() => customers.filter(c => c.balance > 0.005).sort((a, b) => b.balance - a.balance).slice(0, 5), [customers]);
  const recent = useMemo(() => [...(rows ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8), [rows]);

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Günaydın' : now.getHours() < 18 ? 'İyi günler' : 'İyi akşamlar';

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-5 p-4 lg:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">
              {greeting}
              {settings.name ? `, ${settings.name}` : ''}
            </p>
            <h1 className="text-xl font-semibold text-slate-900">Genel Bakış · {MONTHS[now.getMonth()]} {now.getFullYear()}</h1>
          </div>
          <button onClick={onAddCustomer} className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            <Plus className="h-4 w-4" /> Yeni müşteri / proje
          </button>
        </div>

        {customers.length === 0 && (
          <section className="min-w-0 rounded-xl bg-white p-5 shadow-card ring-1 ring-slate-200">
            <h2 className="font-semibold text-slate-900">Hoş geldiniz 👋 Başlamak için iki adım</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <a href={href({ name: 'settings' })} className="flex items-center gap-3 rounded-lg p-3 ring-1 ring-inset ring-slate-200 hover:bg-slate-50">
                <Settings className="h-5 w-5 text-slate-500" />
                <span className="text-sm">
                  <span className="font-medium text-slate-900">Firma bilgilerinizi girin</span>
                  <span className="block text-xs text-slate-500">Logo, adres, IBAN: ekstrede görünür</span>
                </span>
              </a>
              <button onClick={onAddCustomer} className="flex items-center gap-3 rounded-lg p-3 text-left ring-1 ring-inset ring-slate-200 hover:bg-slate-50">
                <UserPlus className="h-5 w-5 text-slate-500" />
                <span className="text-sm">
                  <span className="font-medium text-slate-900">İlk müşteri / projenizi ekleyin</span>
                  <span className="block text-xs text-slate-500">Sözleşme bedeli ve teslim tarihiyle</span>
                </span>
              </button>
            </div>
          </section>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard label="Toplam alacak" value={formatMoney(stats.receivable)} hint={`${customers.filter(c => c.balance > 0.005).length} müşteriden`} tone="text-debit-700" />
          <StatCard label="Bu ay iş / hakediş" value={formatMoney(stats.debit)} hint={`geçen ay ${formatMoney(stats.lastDebit)}`} />
          <StatCard label="Bu ay tahsilat" value={formatMoney(stats.credit)} hint={`geçen ay ${formatMoney(stats.lastCredit)}`} tone="text-credit-700" />
          <StatCard label="Bu ay masraf" value={formatMoney(stats.expense)} hint={`geçen ay ${formatMoney(stats.lastExpense)}`} tone="text-expense-700" />
          <StatCard
            label="Bu ay kâr"
            value={formatMoney(stats.debit - stats.expense)}
            hint="iş − masraf"
            tone={stats.debit - stats.expense >= 0 ? 'text-slate-900' : 'text-red-600'}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <section className="min-w-0 rounded-xl bg-white p-5 shadow-card ring-1 ring-slate-200 lg:col-span-2">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Son 6 ay</h2>
            {rows === null ? <div className="h-[240px] animate-pulse rounded-lg bg-slate-100" /> : <MonthlyChart data={stats.months} />}
          </section>

          <section className="min-w-0 rounded-xl bg-white p-5 shadow-card ring-1 ring-slate-200">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">En çok alacaklı olunan</h2>
            {debtors.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">Açık alacak yok.</p>
            ) : (
              <ul className="space-y-1">
                {debtors.map(c => (
                  <li key={c.id}>
                    <a href={href({ name: 'customers', id: c.id })} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-slate-50">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-900">{c.name}</span>
                        {c.project_title && <span className="block truncate text-xs text-slate-500">{c.project_title}</span>}
                      </span>
                      <span className="tabular whitespace-nowrap text-sm font-semibold text-debit-700">{formatMoney(c.balance)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <section className="min-w-0 rounded-xl bg-white p-5 shadow-card ring-1 ring-slate-200">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Building2 className="h-4 w-4 text-slate-400" /> Devam eden projeler
              </h2>
              <a href={href({ name: 'customers' })} className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900">
                Tümü <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
            {activeProjects.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">Devam eden proje yok.</p>
            ) : (
              <ul className="space-y-3">
                {activeProjects.map(c => {
                  const contract = Number(c.contract_amount) || 0;
                  const billed = billedBy.get(c.id) || 0;
                  const pct = contract ? Math.min(100, (billed / contract) * 100) : null;
                  const days = c.due_date ? Math.ceil((new Date(c.due_date).getTime() - new Date(now.toDateString()).getTime()) / 86400000) : null;
                  return (
                    <li key={c.id}>
                      <a href={href({ name: 'customers', id: c.id })} className="block rounded-lg px-2 py-1.5 hover:bg-slate-50">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0 truncate text-sm font-medium text-slate-900">{c.project_title || c.name}</span>
                          {days !== null && (
                            <span className={`flex items-center gap-1 whitespace-nowrap text-xs ${days < 0 ? 'text-red-600' : days <= 7 ? 'text-expense-700' : 'text-slate-500'}`}>
                              <CalendarClock className="h-3 w-3" />
                              {days < 0 ? `${-days} gün gecikti` : days === 0 ? 'bugün teslim' : `${days} gün`}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-slate-500">{c.project_title ? c.name : c.address}</p>
                        {pct !== null && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-debit-500" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="tabular w-10 text-right text-xs text-slate-500">%{pct.toFixed(0)}</span>
                          </div>
                        )}
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="min-w-0 rounded-xl bg-white p-5 shadow-card ring-1 ring-slate-200">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Son hareketler</h2>
            {rows === null ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            ) : recent.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">Henüz kayıt yok.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recent.map(r => (
                  <li key={`${r.kind}-${r.id}`}>
                    <a href={href({ name: 'customers', id: r.customer_id })} className="flex items-center gap-3 py-2 hover:bg-slate-50">
                      <span className={`w-20 flex-shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-semibold ${KIND_BADGE[r.kind]}`}>{KIND_LABELS[r.kind]}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-slate-800">{r.description}</span>
                        <span className="block truncate text-xs text-slate-400">
                          {names.get(r.customer_id) ?? '—'} · {formatDate(r.date)}
                        </span>
                      </span>
                      <span className="tabular whitespace-nowrap text-sm font-semibold text-slate-900">{formatMoney(r.amount)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
