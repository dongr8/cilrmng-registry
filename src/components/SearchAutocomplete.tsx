"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { display } from "@/lib/member-schema";

export type Suggestion = {
  id: number;
  memberId: string;
  name: string;
  nameAsFiled?: string;
  firstName?: string;
  secondName?: string;
  thirdName?: string;
  grade?: string;
  status?: string;
  region?: string;
  yearOfReg?: string;
  email?: string;
  phone?: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Fired when the user picks a suggestion (click, Enter or Tab). */
  onPick: (suggestion: Suggestion) => void;
  /** Fired when the user submits free text without choosing a suggestion. */
  onSubmit?: (value: string) => void;
  /** Local matcher used when the device is offline. */
  offlineSource?: (query: string) => Suggestion[];
  placeholder?: string;
  endpoint?: string;
  ariaLabel?: string;
  className?: string;
  autoFocus?: boolean;
};

/** Highlight each matching fragment so partial typing is visible. */
function Highlight({ text, query }: { text: string; query: string }) {
  const tokens = query.trim().split(/[\s,]+/).filter((token) => token.length > 0);
  if (!tokens.length || !text) return <>{text}</>;
  const escaped = tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(${escaped.join("|")})`, "ig"));
  return (
    <>
      {parts.map((part, index) =>
        escaped.some((token) => part.toLowerCase() === token.toLowerCase()) ? (
          <mark key={index} className="rounded bg-brand-100 px-0.5 text-brand-800">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

export default function SearchAutocomplete({
  value,
  onChange,
  onPick,
  onSubmit,
  offlineSource,
  placeholder = "Search…",
  endpoint = "/api/guest/suggest",
  ariaLabel = "Search the register",
  className = "",
  autoFocus = false,
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const skipNextFetch = useRef(false);
  const listId = useId();

  const fetchSuggestions = useCallback(
    async (query: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const response = await fetch(`${endpoint}?q=${encodeURIComponent(query)}&limit=8`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("suggest failed");
        const data = (await response.json()) as { suggestions?: Suggestion[] };
        setSuggestions(data.suggestions ?? []);
        setOpen(true);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        const local = offlineSource?.(query) ?? [];
        setSuggestions(local);
        setOpen(local.length > 0);
      } finally {
        setLoading(false);
      }
    },
    [endpoint, offlineSource],
  );

  // Suggest from the very first character, on every keystroke.
  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    const query = value.trim();
    if (query.length < 1) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine && offlineSource) {
      const local = offlineSource(query);
      setSuggestions(local);
      setOpen(local.length > 0);
      return;
    }
    const timer = setTimeout(() => fetchSuggestions(query), 110);
    return () => clearTimeout(timer);
  }, [value, fetchSuggestions, offlineSource]);

  useEffect(() => {
    setActive(-1);
  }, [suggestions]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function choose(suggestion: Suggestion) {
    skipNextFetch.current = true;
    onChange(suggestion.name || suggestion.memberId);
    setOpen(false);
    setSuggestions([]);
    setActive(-1);
    onPick(suggestion);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open && suggestions.length) setOpen(true);
      setActive((index) => (index + 1) % Math.max(1, suggestions.length));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "Tab" && open && active >= 0 && suggestions[active]) {
      event.preventDefault();
      choose(suggestions[active]);
      return;
    }
    if (event.key === "Enter") {
      if (open && active >= 0 && suggestions[active]) {
        event.preventDefault();
        choose(suggestions[active]);
        return;
      }
      setOpen(false);
      onSubmit?.(value);
    }
  }

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-stone-400" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => suggestions.length && setOpen(true)}
        onKeyDown={handleKeyDown}
        className="input pl-10 pr-9"
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-opt-${active}` : undefined}
        autoComplete="off"
        autoFocus={autoFocus}
      />
      {loading ? (
        <span className="absolute right-3 top-3.5 h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" aria-hidden />
      ) : value ? (
        <button
          type="button"
          onClick={() => {
            onChange("");
            setSuggestions([]);
            setOpen(false);
          }}
          className="absolute right-2.5 top-2.5 rounded-lg px-1.5 py-1 text-xs text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          aria-label="Clear search"
        >
          ✕
        </button>
      ) : null}

      {open && suggestions.length ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1.5 max-h-72 w-full overflow-y-auto scroll-thin rounded-xl border border-[#eadfd5] bg-white py-1 shadow-xl"
        >
          <li className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
            {suggestions.length} matching record{suggestions.length === 1 ? "" : "s"} · keep typing to narrow
          </li>
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.id}
              id={`${listId}-opt-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseEnter={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(suggestion)}
              className={`cursor-pointer px-3 py-2 text-left transition ${index === active ? "bg-brand-50" : "hover:bg-stone-50"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-stone-900">
                    <Highlight text={suggestion.name} query={value} />
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-stone-500">
                    <Highlight text={suggestion.memberId} query={value} />
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-stone-400">
                    {display(suggestion.region)} · {display(suggestion.phone)} · {display(suggestion.email)}
                  </p>
                </div>
                {suggestion.grade ? (
                  <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700 ring-1 ring-brand-100">
                    {suggestion.grade}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {open && !suggestions.length && value.trim().length > 0 && !loading ? (
        <div className="absolute z-50 mt-1.5 w-full rounded-xl border border-[#eadfd5] bg-white px-3 py-3 text-xs text-stone-500 shadow-xl">
          No record matches “{value}” yet — keep typing or check the spelling.
        </div>
      ) : null}
    </div>
  );
}
