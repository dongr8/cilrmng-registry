"use client";

import { useCallback, useEffect, useState } from "react";

export type RegisterTotals = {
  total: number;
  active: number;
  states: number;
  grades: number;
  lastUpdated?: string | null;
};

const nf = new Intl.NumberFormat("en-US");

/**
 * Live total of records in the membership database.
 * Polls the shared public endpoint so Home and Records always show the same
 * number, and it updates automatically after an upload, edit or deletion.
 */
export function useRegisterTotals(initial: RegisterTotals) {
  const [totals, setTotals] = useState<RegisterTotals>(initial);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/stats", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as RegisterTotals & { ok?: boolean };
      if (data.ok !== false) {
        setTotals({
          total: data.total ?? 0,
          active: data.active ?? 0,
          states: data.states ?? 0,
          grades: data.grades ?? 0,
          lastUpdated: data.lastUpdated ?? null,
        });
      }
    } catch {
      /* offline — keep the last known figure */
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 20000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    window.addEventListener("meridian:records-changed", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      window.removeEventListener("meridian:records-changed", onFocus);
    };
  }, [refresh]);

  return { totals, refresh };
}

export default function DatabaseTotal({
  initial,
  variant = "card",
  className = "",
}: {
  initial: RegisterTotals;
  variant?: "card" | "banner" | "inline";
  className?: string;
}) {
  const { totals } = useRegisterTotals(initial);

  if (variant === "inline") {
    return (
      <span className={`font-bold text-brand-700 ${className}`} aria-live="polite">
        {nf.format(totals.total)}
      </span>
    );
  }

  if (variant === "banner") {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-x-5 gap-y-1.5 rounded-2xl border border-brand-200 bg-brand-50/70 px-3 py-3 text-center sm:flex-row sm:flex-wrap sm:px-4 ${className}`}
        aria-live="polite"
      >
        <span className="inline-flex flex-wrap items-baseline justify-center gap-2">
          <span className="text-2xl font-black tracking-tight text-brand-700 sm:text-3xl">{nf.format(totals.total)}</span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">records in the database</span>
        </span>
        <span className="hidden h-5 w-px bg-brand-200 sm:block" />
        <span className="text-[11px] text-stone-500">
          {nf.format(totals.active)} active · {nf.format(totals.states)} states · {nf.format(totals.grades)} grades
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          live
        </span>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-[#f1e7df] bg-white/80 px-3 py-2.5 backdrop-blur ${className}`} aria-live="polite">
      <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
        Records in database
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
      </dt>
      <dd className="mt-0.5 text-lg font-bold text-stone-900">{nf.format(totals.total)}</dd>
    </div>
  );
}
