import { useState, useEffect, useCallback } from 'react';
import { Users, BookOpen, Menu, X } from 'lucide-react';
import { supabase, type Customer, type Transaction, type Expense, type Advance, type Note } from '@/lib/supabase';
import CustomerSidebar from '@/components/CustomerSidebar';
import CustomerDetail from '@/components/CustomerDetail';
import AdvancesOverview from '@/components/AdvancesOverview';

export type CustomerWithBalance = Customer & { balance: number };

export default function App({ userEmail }: { userEmail: string }) {
  const [customers, setCustomers] = useState<CustomerWithBalance[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [showAdvances, setShowAdvances] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fetchCustomers = useCallback(async () => {
    const [{ data, error }, { data: txData }] = await Promise.all([
      supabase.from('customers').select('*').order('name'),
      supabase.from('transactions').select('customer_id, entry_type, amount'),
    ]);

    if (error) {
      console.error('Müşteriler yüklenemedi:', error);
      setLoading(false);
      return;
    }

    const balances = new Map<string, number>();
    (txData || []).forEach((t: { customer_id: string; entry_type: string; amount: number }) => {
      const cur = balances.get(t.customer_id) || 0;
      balances.set(t.customer_id, cur + (t.entry_type === 'debit' ? Number(t.amount) : -Number(t.amount)));
    });

    setCustomers(((data || []) as Customer[]).map(c => ({ ...c, balance: balances.get(c.id) || 0 })));
    setLoading(false);
  }, []);

  // silent: arka planda yenile (kayıt eklerken ekran yanıp sönmesin)
  const fetchDetail = useCallback(async (id: string, silent = false) => {
    if (!silent) setDetailLoading(true);
    const [{ data: txData }, { data: expData }, { data: noteData }, { data: advData }] = await Promise.all([
      supabase.from('transactions').select('*').eq('customer_id', id).order('entry_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('expenses').select('*').eq('customer_id', id).order('expense_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('notes').select('*').eq('customer_id', id).order('created_at', { ascending: true }),
      supabase.from('advances').select('*').eq('customer_id', id).order('advance_date', { ascending: false }).order('created_at', { ascending: false }),
    ]);

    const num = <T extends { amount: number }>(rows: T[]) => rows.map(r => ({ ...r, amount: Number(r.amount) }));
    setTransactions(num((txData || []) as Transaction[]));
    setExpenses(num((expData || []) as Expense[]));
    setNotes((noteData || []) as Note[]);
    setAdvances(num((advData || []) as Advance[]));
    setDetailLoading(false);
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    if (selectedId) fetchDetail(selectedId);
    else {
      setTransactions([]);
      setExpenses([]);
      setAdvances([]);
      setNotes([]);
    }
  }, [selectedId, fetchDetail]);

  function handleSelect(id: string) {
    setSelectedId(id);
    setShowAdvances(false);
    setSidebarOpen(false);
  }

  function handleShowAdvances() {
    setShowAdvances(true);
    setSidebarOpen(false);
  }

  function handleDataChanged() {
    if (selectedId) fetchDetail(selectedId, true);
    fetchCustomers();
  }

  function handleCustomerDeleted() {
    setSelectedId(null);
    setTransactions([]);
    setExpenses([]);
    setAdvances([]);
    setNotes([]);
    fetchCustomers();
  }

  async function handleCustomerAdded(id?: string) {
    await fetchCustomers();
    if (id) handleSelect(id);
  }

  const selectedCustomer = customers.find(c => c.id === selectedId) || null;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
          <p className="text-sm text-slate-500">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  const sidebar = (
    <CustomerSidebar
      customers={customers}
      selectedId={selectedId}
      userEmail={userEmail}
      onSelect={handleSelect}
      onCustomerAdded={handleCustomerAdded}
      onShowAdvances={handleShowAdvances}
      advancesActive={showAdvances}
    />
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {/* Mobil üst çubuk */}
      <div className="no-print absolute left-0 top-0 z-30 flex h-14 w-full items-center gap-3 border-b border-slate-700 bg-slate-900 px-4 lg:hidden">
        <button onClick={() => setSidebarOpen(true)} className="text-white" aria-label="Müşteri listesi">
          <Menu className="h-6 w-6" />
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <Users className="h-5 w-5 flex-shrink-0 text-sky-400" />
          <h1 className="truncate text-base font-bold text-white">{showAdvances ? 'Ortak Avansları' : selectedCustomer?.name ?? 'Müşteri Defteri'}</h1>
        </div>
      </div>

      {/* Masaüstü kenar çubuğu */}
      <aside className="no-print hidden w-80 flex-shrink-0 border-r border-slate-700 lg:block">{sidebar}</aside>

      {/* Mobil çekmece */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed left-0 top-0 z-50 h-full w-80 max-w-[85vw] border-r border-slate-700 lg:hidden">
            <div className="absolute right-2 top-2 z-10">
              <button
                onClick={() => setSidebarOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                aria-label="Kapat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {sidebar}
          </aside>
        </>
      )}

      {/* İçerik */}
      <main className="flex-1 overflow-hidden pt-14 lg:pt-0 print:pt-0">
        {showAdvances ? (
          <AdvancesOverview customers={customers} onOpenCustomer={handleSelect} />
        ) : selectedCustomer ? (
          detailLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
            </div>
          ) : (
            <CustomerDetail
              key={selectedCustomer.id}
              customer={selectedCustomer}
              transactions={transactions}
              expenses={expenses}
              advances={advances}
              notes={notes}
              onDataChanged={handleDataChanged}
              onCustomerUpdated={fetchCustomers}
              onCustomerDeleted={handleCustomerDeleted}
            />
          )
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 rounded-2xl bg-slate-200 p-6">
              <BookOpen className="h-12 w-12 text-slate-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-600">Müşteri Seçin</h2>
            <p className="mt-2 max-w-sm text-sm text-slate-400">
              Soldan bir müşteri seçin veya yeni müşteri ekleyerek başlayın. Hesap hareketleri, masraflar, sohbet ve ekstre burada görünecek.
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs text-slate-400">
              <Users className="h-4 w-4" />
              {customers.length} müşteri kayıtlı
            </div>
            <button
              onClick={() => setSidebarOpen(true)}
              className="mt-4 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white lg:hidden"
            >
              Müşteri listesini aç
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
