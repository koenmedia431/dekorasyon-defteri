import { useState, useEffect, useCallback } from 'react';
import { supabase, type Customer, type CustomerWithBalance } from '@/lib/supabase';
import { useRoute, navigate } from '@/lib/router';
import { SettingsProvider } from '@/lib/settings';
import { UIProvider } from '@/components/ui';
import { NavRail, BottomNav } from '@/components/Navigation';
import CustomerList from '@/components/CustomerList';
import CustomerPage from '@/components/CustomerPage';
import CustomerForm from '@/components/CustomerForm';
import Dashboard from '@/components/Dashboard';
import AdvancesOverview from '@/components/AdvancesOverview';
import SettingsPage from '@/components/SettingsPage';
import { Users } from 'lucide-react';

export type { CustomerWithBalance };

export default function App({ userEmail }: { userEmail: string }) {
  return (
    <UIProvider>
      <SettingsProvider>
        <Shell userEmail={userEmail} />
      </SettingsProvider>
    </UIProvider>
  );
}

function Shell({ userEmail }: { userEmail: string }) {
  const route = useRoute();
  const [customers, setCustomers] = useState<CustomerWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewCustomer, setShowNewCustomer] = useState(false);

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
      balances.set(t.customer_id, (balances.get(t.customer_id) || 0) + (t.entry_type === 'debit' ? Number(t.amount) : -Number(t.amount)));
    });
    setCustomers(((data || []) as Customer[]).map(c => ({ ...c, status: c.status ?? 'active', balance: balances.get(c.id) || 0 })));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-debit-500 border-t-transparent" />
      </div>
    );
  }

  const selectedId = route.name === 'customers' ? route.id : undefined;
  const selected = customers.find(c => c.id === selectedId) ?? null;
  // Müşteri detayında mobil alt menü gizlenir (sohbet kutusu ve geri tuşu var)
  const hideBottomNav = route.name === 'customers' && !!selectedId;

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-slate-50">
      <NavRail route={route} userEmail={userEmail} customerCount={customers.length} />

      <main className={`flex min-w-0 flex-1 overflow-hidden ${hideBottomNav ? '' : 'pb-16 lg:pb-0'}`}>
        {route.name === 'dashboard' && <Dashboard customers={customers} onAddCustomer={() => setShowNewCustomer(true)} />}

        {route.name === 'customers' && (
          <>
            <aside className={`no-print w-full flex-shrink-0 border-r border-slate-200 lg:block lg:w-80 ${selectedId ? 'hidden' : 'block'}`}>
              <CustomerList customers={customers} selectedId={selectedId} onAdd={() => setShowNewCustomer(true)} />
            </aside>
            <section className={`min-w-0 flex-1 ${selectedId ? 'block' : 'hidden lg:block'}`}>
              {selected ? (
                <CustomerPage
                  key={selected.id}
                  customer={selected}
                  onCustomerChanged={fetchCustomers}
                  onCustomerDeleted={() => {
                    navigate({ name: 'customers' }, true);
                    fetchCustomers();
                  }}
                />
              ) : selectedId ? (
                <p className="p-8 text-center text-sm text-slate-500">Müşteri bulunamadı.</p>
              ) : (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                  <div className="mb-4 rounded-2xl bg-slate-100 p-5">
                    <Users className="h-10 w-10 text-slate-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-700">Bir müşteri seçin</h2>
                  <p className="mt-1 max-w-sm text-sm text-slate-500">Hesap hareketleri, masraflar, avanslar, sohbet ve ekstre burada görünür.</p>
                </div>
              )}
            </section>
          </>
        )}

        {route.name === 'advances' && <AdvancesOverview customers={customers} />}
        {route.name === 'settings' && <SettingsPage />}
      </main>

      {!hideBottomNav && <BottomNav route={route} />}

      {showNewCustomer && (
        <CustomerForm
          onClose={() => setShowNewCustomer(false)}
          onSaved={async id => {
            setShowNewCustomer(false);
            await fetchCustomers();
            navigate({ name: 'customers', id });
          }}
        />
      )}
    </div>
  );
}
