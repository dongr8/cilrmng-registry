import Link from "next/link";

type BrandProps = {
  name?: string;
  label?: string;
  logoUrl?: string;
  href?: string;
  size?: "sm" | "md" | "lg";
  subtitle?: string;
};

const sizes = {
  sm: { img: "h-9 w-9", title: "text-sm", sub: "text-[11px]" },
  md: { img: "h-10 w-10", title: "text-[15px]", sub: "text-xs" },
  lg: { img: "h-12 w-12", title: "text-lg", sub: "text-xs" },
};

export default function Brand({
  name = "CILRMNG",
  label = "Membership Registry",
  logoUrl = "/images/cilrm-logo.png",
  href = "/",
  size = "md",
  subtitle,
}: BrandProps) {
  const s = sizes[size];
  return (
    <Link href={href} className="group flex min-w-0 max-w-full items-center gap-2.5 sm:gap-3">
      <span className={`${s.img} flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-brand-100 bg-white shadow-[0_2px_8px_rgba(234,88,12,0.12)]`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt={`${name} logo`} className="h-full w-full object-contain" />
      </span>
      <span className="min-w-0">
        <span className={`block truncate font-bold leading-tight tracking-tight text-stone-900 ${s.title}`}>{name}</span>
        <span className={`block truncate font-medium uppercase tracking-[0.14em] text-brand-600 ${s.sub}`}>{label}</span>
        {subtitle ? <span className="block truncate text-[11px] text-stone-500">{subtitle}</span> : null}
      </span>
    </Link>
  );
}
