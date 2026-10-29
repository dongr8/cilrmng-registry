"use client";

import { useRef, useState } from "react";
import { buildRecordCsv, buildRecordHtml, type DocumentOrg } from "@/lib/record-document";

const FALLBACK_ORG: DocumentOrg = {
  orgName: "Chartered Institute of Loan & Risk Management of Nigeria",
  shortName: "CILRMNG",
  tagline: "Minimizing Risks, Maximizing Opportunities",
  logoUrl: "/images/cilrm-logo.png",
  supportEmail: "info@cilrmng.org",
};

/** Inline the crest so the downloaded file keeps its watermark offline. */
async function logoDataUri(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return new URL(url, window.location.origin).href;
  }
}

function save(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function DownloadRecordButton({
  memberId,
  record,
  org,
  label = "Download",
  className = "btn-secondary",
  source,
}: {
  memberId: string;
  record: Record<string, string>;
  org?: DocumentOrg;
  label?: string;
  className?: string;
  source?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  /** Fixed-position menu clamped to the viewport — can never overlap off-screen. */
  function toggleMenu() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 240;
      const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
      const below = rect.bottom + 6;
      const top = below + 120 > window.innerHeight ? Math.max(8, rect.top - 126) : below;
      setMenuPos({ top, left });
    }
    setOpen((value) => !value);
  }
  const safeName = memberId.replace(/[^A-Za-z0-9._-]/g, "-") || "membership-record";
  const sheetOrg = org ?? FALLBACK_ORG;

  async function downloadDocument() {
    setBusy(true);
    try {
      const logoSrc = await logoDataUri(sheetOrg.logoUrl);
      const html = buildRecordHtml({ org: sheetOrg, record, memberId, logoSrc, source });
      save(html, `${safeName}-certified-record.html`, "text/html;charset=utf-8");
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  function downloadCsv() {
    save(buildRecordCsv(record, memberId), `${safeName}.csv`, "text/csv;charset=utf-8");
    setOpen(false);
  }

  return (
    <span className="relative inline-flex">
      <button ref={buttonRef} type="button" className={className} onClick={toggleMenu} disabled={busy}>
        {busy ? "Preparing…" : label}
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <>
          <button type="button" aria-hidden className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} tabIndex={-1} />
          <div
            className="fixed z-50 w-60 rounded-xl border border-[#eadfd5] bg-white p-1 text-left shadow-xl"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <button type="button" onClick={downloadDocument} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-brand-50">
              <span className="block text-xs font-semibold text-stone-800">Certified copy (A4)</span>
              <span className="block text-[10px] leading-snug text-stone-500">Crest watermark + certification · prints to one page</span>
            </button>
            <button type="button" onClick={downloadCsv} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-brand-50">
              <span className="block text-xs font-semibold text-stone-800">Data file (CSV)</span>
              <span className="block text-[10px] leading-snug text-stone-500">Spreadsheet copy with certification header</span>
            </button>
          </div>
        </>
      ) : null}
    </span>
  );
}
