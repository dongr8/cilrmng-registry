"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function deviceToken(): string {
  try {
    const key = "cilrm:presence-token";
    let token = localStorage.getItem(key);
    if (!token) {
      token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62])
        .join("");
      localStorage.setItem(key, token);
    }
    return token;
  } catch {
    return "anon" + Math.random().toString(36).slice(2, 12);
  }
}

/**
 * Persistent live counter of administrators and guests online.
 * Each open tab heartbeats every 25s; sessions idle for 90s drop off.
 * `heartbeatAsGuest` should be true on public pages (guest portal etc.).
 */
export default function OnlineCounter({
  heartbeatAsGuest = false,
  className = "",
  compact = false,
}: {
  heartbeatAsGuest?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const [online, setOnline] = useState<{ admins: number; guests: number } | null>(null);
  const tokenRef = useRef<string>("");

  const beat = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    try {
      const response = heartbeatAsGuest
        ? await fetch("/api/presence", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: tokenRef.current }),
          })
        : await fetch("/api/presence", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { admins?: number; guests?: number };
      setOnline({ admins: data.admins ?? 0, guests: data.guests ?? 0 });
    } catch {
      /* offline — keep last figures */
    }
  }, [heartbeatAsGuest]);

  useEffect(() => {
    tokenRef.current = deviceToken();
    beat();
    const timer = setInterval(beat, 25000);
    const onFocus = () => beat();
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
    };
  }, [beat]);

  if (compact) {
    return (
      <span
        className={`inline-flex shrink-0 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 ${className}`}
        title="Live: administrators and guests online now"
        aria-live="polite"
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        {online ? `${online.admins} admin · ${online.guests} guest${online.guests === 1 ? "" : "s"}` : "…"}
      </span>
    );
  }

  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`} aria-live="polite">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[10px] font-semibold text-brand-700">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
        {online ? online.admins : "…"} admin{online && online.admins === 1 ? "" : "s"} online
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        {online ? online.guests : "…"} guest{online && online.guests === 1 ? "" : "s"} online
      </span>
    </span>
  );
}
