import { useState } from 'react';
import { MessageSquare, BookText, Receipt, FileText, Pencil, Trash2, Phone, MapPin } from 'lucide-react';
import { supabase, type Transaction, type Expense, type Note } from '@/lib/supabase';
import { formatMoney, balanceLabel, type EntryKind } from '@/lib/accounting';
import type { CustomerWithBalance } from '@/App';
import CustomerForm from './CustomerForm';
import EntryForm, { type EditableEntry } from './EntryForm';
import ChatTab from './ChatTab';
import LedgerTab from './LedgerTab';
import ExpensesTab from './ExpensesTab';
import StatementTab from './StatementTab';

type Tab = 'chat' | 'ledger' | 'expenses' | 'statement';

const TABS: { key: Tab; label: string; icon: typeof MessageSquare }[] = [
  { key: 'chat', label: 'Sohbet', icon: MessageSquare },
  { key: 'ledger', label: 'Hesap', icon: BookText },
  { key: 'expenses', label: 'Masraflar', icon: Receipt },
  { key: 'statement', label: 'Ekstre', icon: FileText },
];

interface Props {
  customer: CustomerWithBalance;
  transactions: Transaction[];
  expenses: Expense[];
  notes: Note[];
  onDataChanged: () => void;
  onCustomerUpdated: () => void;
  onCustomerDeleted: () => void;
}

export default function CustomerDetail({
  customer,
  transactions,
  expenses,
  notes,
  onDataChanged,
  onCustomerUpdated,
  onCustomerDeleted,
}: Props) {
  const [tab, setTab] = useState<Tab>('chat');
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [entryModal, setEntryModal] = useState<{ entry?: EditableEntry; kind?: EntryKind } | null>(null);

  const totalDebit = transactions.filter(t => t.entry_type === 'debit').reduce((s, t) => s + t.amount, 0);
  const totalCredit = transactions.filter(t => t.entry_type === 'credit').reduce((s, t) => s + t.amount, 0);
  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
  const balance = totalDebit - totalCredit;
  const profit = totalDebit - totalExpense;

  const editTx = (t: Transaction) => setEntryModal({ entry: { kind: t.entry_type, row: t } });
  const editExp = (e: Expense) => setEntryModal({ entry: { kind: 'expense', row: e } });

  async function deleteCustomer() {
    if (!confirm(`"${customer.name}" ve tüm hesap hareketleri, masrafları ve notları kalıcı olarak silinsin mi?`)) return;
    const { error } = await supabase.from('customers').delete().eq('id', customer.id);
    if (error) alert('Silinemedi: ' + error.message);
    else onCustomerDeleted();
  }

  const stats = [
    { label: 'Bakiye', value: formatMoney(Math.abs(balance)), hint: balanceLabel(balance), color: balance > 0.005 ? 'text-rose-600' : balance < -0.005 ? 'text-emerald-600' : 'text-slate-500' },
    { label: 'Toplam İş', value: formatMoney(totalDebit), hint: 'faturalanan', color: 'text-slate-800' },
    { label: 'Tahsilat', value: formatMoney(totalCredit), hint: 'alınan ödeme', color: 'text-emerald-600' },
    { label: 'Masraf', value: formatMoney(totalExpense), hint: 'bizim gider', color: 'text-amber-600' },
    { label: 'Kâr', value: formatMoney(profit), hint: 'iş − masraf', color: profit >= 0 ? 'text-emerald-600' : 'text-rose-600' },
  ];

  return (
    <div className="flex h-full flex-col">
      <header className="no-print border-b border-slate-200 bg-white px-4 py-3 lg:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold text-slate-800">{customer.name}</h2>
            <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
              {customer.phone && (
                <a href={`tel:${customer.phone}`} className="flex items-center gap-1 hover:text-sky-600">
                  <Phone className="h-3 w-3" /> {customer.phone}
                </a>
              )}
              {customer.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {customer.address}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-shrink-0 gap-1">
            <button onClick={() => setEditingCustomer(true)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Düzenle">
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={deleteCustomer} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Müşteriyi sil">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {stats.map((s, i) => (
            <div key={s.label} className={`min-w-0 rounded-lg bg-slate-50 px-2.5 py-2 sm:px-3 ${i >= 3 ? 'hidden sm:block' : ''}`}>
              <p className="text-[11px] font-semibold text-slate-500">{s.label}</p>
              <p className={`whitespace-nowrap text-[13px] font-bold sm:text-sm ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-slate-400">{s.hint}</p>
            </div>
          ))}
        </div>

        <nav className="-mb-3 mt-3 flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
                tab === t.key ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="min-h-0 flex-1">
        {tab === 'chat' && (
          <ChatTab customerId={customer.id} notes={notes} transactions={transactions} expenses={expenses} onChanged={onDataChanged} onEditTx={editTx} onEditExpense={editExp} />
        )}
        {tab === 'ledger' && (
          <LedgerTab transactions={transactions} onEdit={editTx} onAdd={kind => setEntryModal({ kind })} />
        )}
        {tab === 'expenses' && (
          <ExpensesTab expenses={expenses} totalDebit={totalDebit} onEdit={editExp} onAdd={() => setEntryModal({ kind: 'expense' })} />
        )}
        {tab === 'statement' && <StatementTab customer={customer} transactions={transactions} />}
      </div>

      {editingCustomer && (
        <CustomerForm
          customer={customer}
          onClose={() => setEditingCustomer(false)}
          onSaved={() => {
            setEditingCustomer(false);
            onCustomerUpdated();
          }}
        />
      )}
      {entryModal && (
        <EntryForm
          customerId={customer.id}
          entry={entryModal.entry}
          initialKind={entryModal.kind}
          onClose={() => setEntryModal(null)}
          onSaved={() => {
            setEntryModal(null);
            onDataChanged();
          }}
        />
      )}
    </div>
  );
}
