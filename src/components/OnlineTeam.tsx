"use client";

import { useCallback, useEffect, useState } from "react";

type PresenceAdmin = { id: number; name: string; email: string; role: string; lastSeenAt?: string; isSelf?: boolean };

export default function OnlineTeam() {
  const [admins, setAdmins] = useState<PresenceAdmin[]>([]);
  const [count, setCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/presence", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { count?: number; admins?: PresenceAdmin[] };
      setAdmins(data.admins ?? []);
      setCount(data.count ?? 0);
      setLoaded(true);
    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <div className="card card-pad">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Team presence</p>
          <h2 className="mt-1 text-base font-bold text-stone-900">Administrators online</h2>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          {loaded ? count : "—"}
        </span>
      </div>
      <ul className="mt-4 space-y-2">
        {admins.slice(0, 5).map((person) => (
          <li key={person.id} className="flex items-center gap-3 rounded-xl border border-[#f1e7df] px-3 py-2">
            <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
              {person.name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("")}
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-stone-800">
                {person.name} {person.isSelf ? <span className="text-[10px] font-medium text-brand-600">(you)</span> : null}
              </p>
              <p className="truncate text-[11px] text-stone-500">{person.role === "root" ? "Root admin" : "Administrator"}</p>
            </div>
            <span className="text-[10px] font-medium text-emerald-600">active</span>
          </li>
        ))}
        {loaded && admins.length === 0 ? <li className="rounded-xl bg-stone-50 px-3 py-4 text-center text-xs text-stone-500">No admins active right now.</li> : null}
      </ul>
      <p className="mt-3 text-[11px] leading-relaxed text-stone-400">
        Presence is measured by a heartbeat every 25 seconds. Sessions idle for 90 seconds drop off the list automatically.
      </p>
    </div>
  );
}
