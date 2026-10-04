import { useLayoutEffect, useRef, useState } from 'react';
import { formatMoney } from '@/lib/accounting';

export interface MonthPoint {
  key: string; // YYYY-MM
  label: string; // "Eki"
  fullLabel: string; // "Ekim 2026"
  debit: number;
  credit: number;
  expense: number;
}

// Seri sırası ve renkleri: renk körlüğüne göre doğrulanmış palet (açık + koyu tema)
const SERIES = [
  { key: 'debit', label: 'İş / Fatura', fill: 'fill-debit-500', swatch: 'bg-debit-500' },
  { key: 'credit', label: 'Tahsilat', fill: 'fill-credit-500', swatch: 'bg-credit-500' },
  { key: 'expense', label: 'Masraf', fill: 'fill-expense-500', swatch: 'bg-expense-500' },
] as const;

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',').replace(',0', '')} mn`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} bin`;
  return String(Math.round(n));
}

// "Güzel" eksen adımı: 1, 2, 2.5, 5 × 10^n
function niceMax(v: number): { max: number; step: number } {
  if (v <= 0) return { max: 1000, step: 250 };
  const raw = v / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw)!;
  return { max: Math.ceil(v / step) * step, step };
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    setWidth(ref.current.clientWidth);
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export default function MonthlyChart({ data }: { data: MonthPoint[] }) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);

  const height = 220;
  const pad = { top: 12, right: 8, bottom: 26, left: 48 };
  const innerW = Math.max(100, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const peak = Math.max(0, ...data.flatMap(d => [d.debit, d.credit, d.expense]));
  const { max, step } = niceMax(peak);
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const groupW = innerW / data.length;
  const gap = 2; // çubuklar arası yüzey boşluğu
  const barW = Math.max(4, Math.min(22, (groupW * 0.62 - gap * 2) / 3));
  const groupInner = barW * 3 + gap * 2;
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;

  // Üstü 4px yuvarlatılmış, tabana oturan çubuk
  const barPath = (x: number, v: number) => {
    const top = y(v);
    const h = pad.top + innerH - top;
    if (h <= 0) return '';
    const r = Math.min(4, h, barW / 2);
    const base = pad.top + innerH;
    return `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${base} Z`;
  };

  const h = hover !== null ? data[hover] : null;

  return (
    <div ref={wrapRef} className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600" aria-label="Açıklama">
          {SERIES.map(s => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm ${s.swatch}`} /> {s.label}
            </span>
          ))}
        </div>
        <button onClick={() => setAsTable(t => !t)} className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline">
          {asTable ? 'Grafik olarak göster' : 'Tablo olarak göster'}
        </button>
      </div>

      {asTable ? (
        <div className="overflow-x-auto">
          <table className="tabular w-full text-sm">
            <thead className="text-xs text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="py-1.5 text-left font-medium">Ay</th>
                {SERIES.map(s => (
                  <th key={s.key} className="py-1.5 text-right font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(d => (
                <tr key={d.key} className="border-b border-slate-100">
                  <td className="py-1.5 text-slate-700">{d.fullLabel}</td>
                  {SERIES.map(s => (
                    <td key={s.key} className="py-1.5 text-right text-slate-800">
                      {formatMoney(d[s.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative w-full" onMouseLeave={() => setHover(null)}>
          <svg width={width} height={height} className="block max-w-full" role="img" aria-label="Son 6 ayın iş, tahsilat ve masraf tutarları">
            {/* Izgara ve eksen */}
            {ticks.map(t => (
              <g key={t}>
                <line x1={pad.left} x2={pad.left + innerW} y1={y(t)} y2={y(t)} className={t === 0 ? 'stroke-slate-300' : 'stroke-slate-200'} strokeWidth={1} />
                <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="tabular fill-slate-400 text-[10px]">
                  {formatCompact(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const gx = pad.left + i * groupW;
              const x0 = gx + (groupW - groupInner) / 2;
              return (
                <g key={d.key}>
                  {hover === i && <rect x={gx + 2} y={pad.top} width={groupW - 4} height={innerH} rx={6} className="fill-slate-100" />}
                  {SERIES.map((s, j) => (
                    <path key={s.key} d={barPath(x0 + j * (barW + gap), d[s.key])} className={s.fill} />
                  ))}
                  <text x={gx + groupW / 2} y={height - 8} textAnchor="middle" className={`text-[11px] ${hover === i ? 'fill-slate-900 font-semibold' : 'fill-slate-500'}`}>
                    {d.label}
                  </text>
                  {/* Geniş vurgu alanı (fare / dokunma) */}
                  <rect
                    x={gx}
                    y={pad.top}
                    width={groupW}
                    height={innerH + pad.bottom}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onClick={() => setHover(hover === i ? null : i)}
                  />
                </g>
              );
            })}
          </svg>
          {h && hover !== null && (
            <div
              className="pointer-events-none absolute top-2 z-10 w-48 rounded-lg bg-white p-2.5 text-xs shadow-lg ring-1 ring-slate-200"
              style={{ left: Math.min(Math.max(pad.left + hover * groupW + groupW / 2 - 96, 0), width - 192) }}
            >
              <p className="mb-1.5 font-semibold text-slate-900">{h.fullLabel}</p>
              {SERIES.map(s => (
                <p key={s.key} className="flex items-center justify-between gap-2 py-0.5 text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-sm ${s.swatch}`} /> {s.label}
                  </span>
                  <span className="tabular font-semibold text-slate-900">{formatMoney(h[s.key])}</span>
                </p>
              ))}
              <p className="mt-1 flex justify-between border-t border-slate-100 pt-1 text-slate-500">
                Kâr (iş − masraf) <span className="tabular font-semibold text-slate-900">{formatMoney(h.debit - h.expense)}</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
