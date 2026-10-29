"use client";

import { useEffect, useState } from "react";
import { queueSize } from "@/lib/offline-client";

export default function ConnectionBadge({ className = "" }: { className?: string }) {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    const refresh = () => queueSize().then(setPending).catch(() => undefined);
    refresh();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    window.addEventListener("meridian:queue-changed", refresh);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      window.removeEventListener("meridian:queue-changed", refresh);
    };
  }, []);

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
        online ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-800"
      } ${className}`}
      title={online ? "Connected — records sync live" : "Offline — changes are queued on this device"}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-500" : "bg-amber-500"} ${online ? "animate-pulse" : ""}`} />
      {online ? "Online" : "Offline mode"}
      {pending > 0 ? <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] text-amber-700 ring-1 ring-amber-200">{pending} queued</span> : null}
    </span>
  );
}
