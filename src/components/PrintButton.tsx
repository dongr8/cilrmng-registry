"use client";

export default function PrintButton({ label = "Print / save as PDF", className = "btn-primary" }: { label?: string; className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      {label}
    </button>
  );
}
