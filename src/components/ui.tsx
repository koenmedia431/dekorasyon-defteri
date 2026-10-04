import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

// ===================== BİLDİRİMLER (toast) =====================
type ToastKind = 'success' | 'error';
interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}

interface ToastApi {
  success: (text: string) => void;
  error: (text: string) => void;
}

// ===================== ONAY PENCERESİ =====================
interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  secondaryText?: string; // üçüncü seçenek (ör. "Sadece mesajı sil")
  danger?: boolean;
}
type ConfirmResult = 'confirm' | 'secondary' | false;

const ToastContext = createContext<ToastApi | null>(null);
const ConfirmContext = createContext<((o: ConfirmOptions) => Promise<ConfirmResult>) | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (r: ConfirmResult) => void }) | null>(null);
  const seq = useRef(0);

  const push = useCallback((kind: ToastKind, text: string) => {
    const id = ++seq.current;
    setToasts(t => [...t.slice(-2), { id, kind, text }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), kind === 'error' ? 6000 : 3000);
  }, []);

  const toastApi = useRef<ToastApi>({ success: t => push('success', t), error: t => push('error', t) });

  const confirm = useCallback(
    (o: ConfirmOptions) => new Promise<ConfirmResult>(resolve => setDialog({ ...o, resolve })),
    []
  );

  function close(r: ConfirmResult) {
    dialog?.resolve(r);
    setDialog(null);
  }

  return (
    <ToastContext.Provider value={toastApi.current}>
      <ConfirmContext.Provider value={confirm}>
        {children}

        {/* Bildirimler */}
        <div className="no-print pointer-events-none fixed inset-x-0 bottom-20 z-[80] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6">
          {toasts.map(t => (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex max-w-sm items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
                t.kind === 'success' ? 'bg-slate-900' : 'bg-red-600'
              }`}
            >
              {t.kind === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-credit-300" /> : <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />}
              <span>{t.text}</span>
              <button onClick={() => setToasts(x => x.filter(y => y.id !== t.id))} className="ml-1 opacity-70 hover:opacity-100" aria-label="Kapat">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Onay penceresi */}
        {dialog && (
          <div className="no-print fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={() => close(false)}>
            <div role="alertdialog" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-base font-semibold text-slate-900">{dialog.title}</h3>
              {dialog.message && <p className="mt-1.5 whitespace-pre-line text-sm text-slate-600">{dialog.message}</p>}
              <div className="mt-5 flex flex-col gap-2">
                <button
                  autoFocus
                  onClick={() => close('confirm')}
                  className={`rounded-lg py-2.5 text-sm font-semibold text-white ${dialog.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-900 hover:bg-slate-800'}`}
                >
                  {dialog.confirmText ?? 'Tamam'}
                </button>
                {dialog.secondaryText && (
                  <button onClick={() => close('secondary')} className="rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    {dialog.secondaryText}
                  </button>
                )}
                <button onClick={() => close(false)} className="py-2 text-sm font-medium text-slate-500 hover:text-slate-700">
                  Vazgeç
                </button>
              </div>
            </div>
          </div>
        )}
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('UIProvider eksik');
  return ctx;
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('UIProvider eksik');
  return ctx;
}

// ===================== ORTAK PARÇALAR =====================
export function StatCard({ label, value, hint, tone = 'text-slate-900', className = '' }: { label: string; value: string; hint?: ReactNode; tone?: string; className?: string }) {
  return (
    <div className={`min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card ${className}`}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`tabular mt-1 truncate text-lg font-semibold ${tone}`} title={value}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export const STATUS_LABELS = { quote: 'Teklif', active: 'Devam ediyor', done: 'Tamamlandı' } as const;
export type ProjectStatus = keyof typeof STATUS_LABELS;

const STATUS_STYLE: Record<ProjectStatus, string> = {
  quote: 'bg-slate-100 text-slate-600 ring-slate-200',
  active: 'bg-debit-50 text-debit-700 ring-debit-100',
  done: 'bg-credit-50 text-credit-700 ring-credit-100',
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATUS_STYLE[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
