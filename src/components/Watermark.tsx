type WatermarkProps = {
  logoUrl?: string;
  /** subtle = page background wash · print = strong A4 document watermark */
  variant?: "subtle" | "print";
  label?: string;
};

export default function Watermark({ logoUrl = "/images/cilrm-logo.png", variant = "subtle", label }: WatermarkProps) {
  if (variant === "print") {
    return (
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="" className="w-[62%] max-w-[135mm] opacity-[0.07] grayscale" />
        {label ? <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.4em] text-stone-300">{label}</p> : null}
      </div>
    );
  }
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoUrl} alt="" className="w-[70vmin] max-w-[620px] opacity-[0.035] grayscale select-none" />
    </div>
  );
}
