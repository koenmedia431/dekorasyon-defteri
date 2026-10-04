import { useState } from 'react';
import { MessageSquare, BookText, Receipt, FileText, HandCoins, Pencil, Trash2, Phone, MapPin, ArrowLeft, Download } from 'lucide-react';
import { supabase, type Transaction, type Expense, type Advance, type Note, type CustomerWithBalance } from '@/lib/supabase';
import { formatMoney, formatDate, balanceLabel, KIND_LABELS, type EntryKind } from '@/lib/accounting';
import { downloadCsv, slug } from '@/lib/exportCsv';
import { href } from '@/lib/router';
import CustomerForm from './CustomerForm';
import EntryForm, { type EditableEntry } from './EntryForm';
import ChatTab from './ChatTab';
import LedgerTab from './LedgerTab';
import ExpensesTab from './ExpensesTab';
import StatementTab from './StatementTab';
import AdvancesTab from './AdvancesTab';
import { StatCard, STATUS_LABELS, useConfirm, useToast, type ProjectStatus } from './ui';

type Tab = 'chat' | 'ledger' | 'expenses' | 'advances' | 'statement';

const TABS: { key: Tab; label: string; icon: typeof MessageSquare }[] = [
  { key: 'chat', label: 'Sohbet', icon: MessageSquare },
  { key: 'ledger', label: 'Hesap', icon: BookText },
  { key: 'expenses', label: 'Masraflar', icon: Receipt },
  { key: 'advances', label: 'Avanslar', icon: HandCoins },
  { key: 'statement', label: 'Ekstre', icon: FileText },
];

interface Props {
  customer: CustomerWithBalance;
  transactions: Transaction[];
  expenses: Expense[];
  advances: Advance[];
  notes: Note[];
  onDataChanged: () => void;
  onCustomerUpdated: () => void;
  onCustomerDeleted: () => void;
}

export default function CustomerDetail({ customer, transactions, expenses, advances, notes, onDataChanged, onCustomerUpdated, onCustomerDeleted }: Props) {
  const [tab, setTab] = useState<Tab>('chat');
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [entryModal, setEntryModal] = useState<{ entry?: EditableEntry; kind?: EntryKind; partner?: string } | null>(null);
  const confirm = useConfirm();
  const toast = useToast();

  const totalDebit = transactions.filter(t => t.entry_type === 'debit').reduce((s, t) => s + t.amount, 0);
  const totalCredit = transactions.filter(t => t.entry_type === 'credit').reduce((s, t) => s + t.amount, 0);
  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
  const totalAdvance = advances.reduce((s, a) => s + a.amount, 0);
  const balance = totalDebit - totalCredit;
  const profit = totalDebit - totalExpense;

  const editTx = (t: Transaction) => setEntryModal({ entry: { kind: t.entry_type, row: t } });
  const editExp = (e: Expense) => setEntryModal({ entry: { kind: 'expense', row: e } });
  const editAdv = (a: Advance) => setEntryModal({ entry: { kind: 'advance', row: a } });

  async function deleteCustomer() {
    const ok = await confirm({
      title: `"${customer.name}" silinsin mi?`,
      message: 'Müşterinin tüm hesap hareketleri, masrafları, avansları ve notları kalıcı olarak silinir. Bu işlem geri alınamaz.',
      confirmText: 'Müşteriyi sil',
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('customers').delete().eq('id', customer.id);
    if (error) return toast.error('Silinemedi: ' + error.message);
    toast.success('Müşteri silindi');
    onCustomerDeleted();
  }

  async function changeStatus(status: ProjectStatus) {
    const { error } = await supabase.from('customers').update({ status }).eq('id', customer.id);
    if (error) return toast.error('Durum değiştirilemedi');
    toast.success(`Durum: ${STATUS_LABELS[status]}`);
    onCustomerUpdated();
  }

  function exportAll() {
    const rows = [
      ...transactions.map(t => [formatDate(t.entry_date), KIND_LABELS[t.entry_type], t.description, '', t.entry_type === 'debit' ? t.amount : null, t.entry_type === 'credit' ? t.amount : null, null, null]),
      ...expenses.map(e => [formatDate(e.expense_date), KIND_LABELS.expense, e.description, e.category ?? '', null, null, e.amount, null]),
      ...advances.map(a => [formatDate(a.advance_date), KIND_LABELS.advance, a.description, a.partner, null, null, null, a.amount]),
    ].sort((x, y) => String(x[0]).split('.').reverse().join('').localeCompare(String(y[0]).split('.').reverse().join('')));
    downloadCsv(`${slug(customer.name)}-hesap`, ['Tarih', 'Tür', 'Açıklama', 'Kategori / Ortak', 'Borç (İş)', 'Tahsilat', 'Masraf', 'Avans'], rows);
    toast.success('Excel dosyası indirildi');
  }

  return (
    <div className="flex h-full flex-col">
      <header className="no-print border-b border-slate-200 bg-white px-4 pt-3 lg:px-6 lg:pt-4">
        <div className="flex items-start gap-2">
          <a href={href({ name: 'customers' })} className="-ml-1 mt-0.5 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Müşteri listesi">
            <ArrowLeft className="h-5 w-5" />
          </a>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-semibold text-slate-900">{customer.name}</h2>
              <select
                value={customer.status}
                onChange={e => changeStatus(e.target.value as ProjectStatus)}
                className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 focus:border-debit-400 focus:outline-none"
                aria-label="Proje durumu"
              >
                {(Object.keys(STATUS_LABELS) as ProjectStatus[]).map(s => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            {customer.project_title && <p className="mt-0.5 truncate text-sm text-slate-600">{customer.project_title}</p>}
            <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
              {customer.phone && (
                <a href={`tel:${customer.phone}`} className="flex items-center gap-1 hover:text-debit-600">
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
          <div className="flex flex-shrink-0 gap-0.5">
            <button onClick={exportAll} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Excel'e aktar">
              <Download className="h-4 w-4" />
            </button>
            <button onClick={() => setEditingCustomer(true)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Bilgileri düzenle">
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={deleteCustomer} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Müşteriyi sil">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <ProjectProgress customer={customer} billed={totalDebit} />

        <div className="no-scrollbar -mx-4 mt-3 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 sm:mx-0 sm:scroll-px-0 sm:grid sm:grid-cols-3 sm:px-0 2xl:grid-cols-6">
          <StatCard className={STAT} label="Bakiye" value={formatMoney(Math.abs(balance))} hint={balanceLabel(balance)} tone={balance > 0.005 ? 'text-debit-700' : balance < -0.005 ? 'text-credit-700' : 'text-slate-500'} />
          <StatCard className={STAT} label="Toplam iş" value={formatMoney(totalDebit)} hint="faturalanan" />
          <StatCard className={STAT} label="Tahsilat" value={formatMoney(totalCredit)} hint="alınan ödeme" tone="text-credit-700" />
          <StatCard className={STAT} label="Masraf" value={formatMoney(totalExpense)} hint="bizim gider" tone="text-expense-700" />
          <StatCard className={STAT} label="Kâr" value={formatMoney(profit)} hint="iş − masraf" tone={profit >= 0 ? 'text-slate-900' : 'text-red-600'} />
          <StatCard className={STAT} label="Ortak avansı" value={formatMoney(totalAdvance)} hint={`kalan ${formatMoney(profit - totalAdvance)}`} tone="text-advance-600" />
        </div>

        <nav className="no-scrollbar -mb-px mt-3 flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium ${
                tab === t.key ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
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
          <ChatTab
            customerId={customer.id}
            notes={notes}
            transactions={transactions}
            expenses={expenses}
            advances={advances}
            onChanged={onDataChanged}
            onEditTx={editTx}
            onEditExpense={editExp}
            onEditAdvance={editAdv}
          />
        )}
        {tab === 'ledger' && <LedgerTab transactions={transactions} onEdit={editTx} onAdd={kind => setEntryModal({ kind })} />}
        {tab === 'expenses' && <ExpensesTab expenses={expenses} totalDebit={totalDebit} onEdit={editExp} onAdd={() => setEntryModal({ kind: 'expense' })} />}
        {tab === 'advances' && <AdvancesTab advances={advances} profit={profit} onEdit={editAdv} onAdd={partner => setEntryModal({ kind: 'advance', partner })} />}
        {tab === 'statement' && <StatementTab customer={customer} transactions={transactions} />}
      </div>

      {editingCustomer && (
        <CustomerForm
          customer={customer}
          onClose={() => setEditingCustomer(false)}
          onSaved={() => {
            setEditingCustomer(false);
            toast.success('Müşteri bilgileri kaydedildi');
            onCustomerUpdated();
          }}
        />
      )}
      {entryModal && (
        <EntryForm
          customerId={customer.id}
          entry={entryModal.entry}
          initialKind={entryModal.kind}
          initialPartner={entryModal.partner}
          onClose={() => setEntryModal(null)}
          onSaved={msg => {
            setEntryModal(null);
            toast.success(msg);
            onDataChanged();
          }}
        />
      )}
    </div>
  );
}

// Sözleşme bedeline göre faturalanan oran ve teslim tarihi
const STAT = 'w-[44%] shrink-0 snap-start sm:w-auto';

function ProjectProgress({ customer, billed }: { customer: CustomerWithBalance; billed: number }) {
  const contract = Number(customer.contract_amount) || 0;
  if (!contract && !customer.due_date && !customer.start_date) return null;
  const pct = contract ? Math.min(100, (billed / contract) * 100) : 0;
  const days = customer.due_date ? Math.ceil((new Date(customer.due_date).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000) : null;
  const dueTone = days === null || customer.status === 'done' ? 'text-slate-500' : days < 0 ? 'text-red-600' : days <= 7 ? 'text-expense-700' : 'text-slate-500';
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs">
        {contract > 0 ? (
          <span className="text-slate-600">
            Sözleşme <span className="tabular font-semibold text-slate-900">{formatMoney(contract)}</span> · faturalanan{' '}
            <span className="tabular font-semibold text-slate-900">%{pct.toFixed(0)}</span> · kalan iş{' '}
            <span className="tabular font-semibold text-slate-900">{formatMoney(Math.max(0, contract - billed))}</span>
          </span>
        ) : (
          <span className="text-slate-500">Sözleşme bedeli girilmemiş</span>
        )}
        <span className={dueTone}>
          {customer.start_date && <>Başlangıç {formatDate(customer.start_date)} · </>}
          {customer.due_date ? (
            <>
              Teslim {formatDate(customer.due_date)}
              {customer.status !== 'done' && days !== null && (days < 0 ? ` · ${-days} gün gecikti` : days === 0 ? ' · bugün' : ` · ${days} gün kaldı`)}
            </>
          ) : (
            'Teslim tarihi yok'
          )}
        </span>
      </div>
      {contract > 0 && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-debit-500" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}
