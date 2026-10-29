import Link from "next/link";
import PublicShell from "@/components/PublicShell";
import DatabaseTotal from "@/components/DatabaseTotal";
import { DEFAULT_SETTINGS, getSettings, rootExists } from "@/lib/auth";
import { getRegisterStats } from "@/lib/members";
import { backupStats } from "@/lib/backups";

export const dynamic = "force-dynamic";

const numberFormat = new Intl.NumberFormat("en-US");

async function loadHomeData() {
  try {
    const [settings, stats, vault, hasRoot] = await Promise.all([
      getSettings(),
      getRegisterStats(),
      backupStats(),
      rootExists(),
    ]);
    return { settings, stats, vaultCount: vault.count, vaultBytes: vault.bytes, hasRoot };
  } catch {
    return {
      settings: { ...DEFAULT_SETTINGS, lastAutoBackupAt: null, updatedAt: new Date() },
      stats: { total: 0, active: 0, pending: 0, expired: 0, newThisMonth: 0, regions: 0, withEmail: 0, withPhone: 0, byCategory: [], byRegion: [], byStatus: [] },
      vaultCount: 0,
      vaultBytes: 0,
      hasRoot: false,
    };
  }
}

const features = [
  {
    title: "Excel, CSV & paste import",
    body: "Drop your .xlsx/.csv register or paste it. NAME, Registration Number, Certificate Collected, Year of Reg, Contact Address, Tel. No and E-mail auto-map on sight.",
    icon: "M4 5h16M4 12h16M4 19h10",
  },
  {
    title: "Original format preserved",
    body: "One NAME cell is split automatically into First, Second and Third name, while the original cell text is preserved exactly as filed.",
    icon: "M4 7h16v10H4zM8 11h8",
  },
  {
    title: "Guest lookup, read-only",
    body: "Members search the register and open their record instantly — no code, no sign-in. View, print an A4 copy with the crest watermark, or download as CSV.",
    icon: "M12 3l7 4v5c0 4-3 7-7 9-4-2-7-5-7-9V7z",
  },
  {
    title: "Live admin presence",
    body: "Root and approved admins can send a secure read-only link to any member straight from Settings, then track views and revoke it.",
    icon: "M16 19v-1a4 4 0 00-8 0v1M12 11a3 3 0 100-6 3 3 0 000 6",
  },
  {
    title: "Works offline, syncs later",
    body: "The register hits the device cache, so edits and imports captured without signal are queued and replayed the moment the network returns.",
    icon: "M4 12a8 8 0 0114-5m2 3a8 8 0 01-14 5M4 5v4h4m12 10v-4h-4",
  },
  {
    title: "A4 output with crest watermark",
    body: "Guest and admin printouts are true A4 documents carrying the institute crest as a watermark. Blank fields are always marked “Nil”.",
    icon: "M5 5h14v14H5zM9 9h6v6H9z",
  },
];

export default async function HomePage() {
  const { settings, stats, vaultCount, vaultBytes, hasRoot } = await loadHomeData();
  const statCards = [
    { label: "Active memberships", value: numberFormat.format(stats.active) },
    { label: "States covered", value: numberFormat.format(stats.regions) },
    { label: "Vault snapshots", value: numberFormat.format(vaultCount) },
  ];
  const initialTotals = {
    total: stats.total,
    active: stats.active,
    states: stats.regions,
    grades: stats.byCategory.length,
  };

  return (
    <PublicShell settings={settings}>

      <section className="mesh relative overflow-hidden">
        <div className="absolute inset-0 grid-fade" aria-hidden />
        <div className="relative mx-auto grid grid-cols-1 max-w-6xl gap-10 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:pb-24 lg:pt-20">
          <div className="animate-rise">
            <span className="eyebrow max-w-full text-[10px] leading-relaxed sm:text-[11px]">
              Established by the act of Parliament of the Federal Republic of Nigeria Gazetted Bill No. SB 220 Vol. 9 of 2012
            </span>
            <h1 className="mt-5 text-[1.9rem] font-black leading-[1.08] tracking-tight text-stone-900 sm:text-5xl lg:text-[3.4rem]">
              Every member.
              <br />
              <span className="text-brand-600">Verified, portable,</span>
              <br />
              always available.
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-stone-600 sm:text-base">
              {settings.orgName} keeps the institute register in one secure place. Import up to 100,000 rows from Excel, CSV or clipboard,
              send members a read-only link to their own A4 record, and keep working when the network drops.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href={hasRoot ? "/login" : "/setup"} className="btn-primary px-5 py-3 text-sm">
                {hasRoot ? "Root admin sign in" : "Root admin sign up"}
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link href="/guest" className="btn-secondary px-5 py-3 text-sm">
                Search records
              </Link>
            </div>
            <p className="mt-3 text-xs text-stone-500">
              {hasRoot
                ? "Administrators must sign in to upload files, edit records or manage the team."
                : "No root administrator yet — complete the one-time sign-up to activate administration."}
            </p>
            <dl className="mt-8 grid max-w-lg grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
              <DatabaseTotal initial={initialTotals} />
              {statCards.map((card) => (
                <div key={card.label} className="rounded-xl border border-[#f1e7df] bg-white/80 px-3 py-2.5 backdrop-blur">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">{card.label}</dt>
                  <dd className="mt-0.5 text-lg font-bold text-stone-900">{card.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Offline-ready PWA</span>
              <span>20-column schema</span>
              <span>Read-only guest access</span>
              <span>Vault: {(vaultBytes / 1024 / 1024).toFixed(1)} MB stored</span>
            </p>
          </div>

          <div className="animate-rise">
            <div className="relative mx-auto max-w-md">
              <div className="absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-brand-200/60 via-white to-brand-100/40 blur-xl" aria-hidden />
              <div className="relative rounded-[1.6rem] border border-brand-100 bg-white p-5 shadow-[0_24px_60px_-30px_rgba(154,52,18,0.45)]">
                <div className="flex items-center justify-between">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={settings.logoUrl} alt={`${settings.orgName} crest`} className="h-14 w-14 rounded-xl border border-brand-100 object-cover" />
                  <span className="badge bg-emerald-50 text-emerald-700 ring-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
                  </span>
                </div>
                <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-600">Membership card</p>
                <p className="mt-1 text-xl font-bold text-stone-900">OLOWOOKERE OLUWASEYI ISAAC</p>
                <p className="text-sm text-stone-500">3932/SILRM · Grade SILRM</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-brand-50 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-brand-700/70">State</p>
                    <p className="font-semibold text-stone-800">Lagos</p>
                  </div>
                  <div className="rounded-xl bg-stone-50 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-stone-400">Certificate</p>
                    <p className="font-semibold text-stone-800">Nil</p>
                  </div>
                </div>
                <div className="mt-4 rounded-xl border border-dashed border-brand-200 bg-brand-50/40 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">Guest lookup</p>
                  <p className="mt-1 text-xs text-stone-600">
                    Search the register and open any record. View, print A4 or download — never edit.
                  </p>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-dashed border-stone-200 pt-3 text-[11px] text-stone-400">
                  <span>Registry sync · live</span>
                  <span className="font-semibold text-brand-600">MERIDIAN</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
        <DatabaseTotal initial={initialTotals} variant="banner" />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { role: "For members", title: "View your own record", body: "Search by registration number or any of your three names, then view, print an A4 copy or download it. Missing fields read Nil.", href: "/guest", cta: "Open guest portal" },
            { role: "For administrators", title: "Run the register", body: "Sign in to upload Excel/CSV files, edit records, send guests their record links and work offline when needed.", href: hasRoot ? "/login" : "/setup", cta: hasRoot ? "Sign in to dashboard" : "Start sign-up" },
            { role: "For root admin", title: "Sign in first", body: "Root signs up once, then signs in to register the team. Root is permanent — it can never be removed, suspended or demoted.", href: hasRoot ? "/login" : "/setup", cta: hasRoot ? "Root admin sign in" : "Root admin sign up" },
          ].map((card, index) => (
            <div key={card.role} className="card card-pad flex flex-col justify-between transition hover:-translate-y-0.5 hover:shadow-md">
              <div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white">{index + 1}</div>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-600">{card.role}</p>
                <h2 className="mt-1 text-lg font-bold text-stone-900">{card.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{card.body}</p>
              </div>
              <Link href={card.href} className="link mt-5 text-sm">{card.cta} →</Link>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="border-y border-[#f1e7df] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="max-w-2xl">
            <span className="eyebrow">Built for real institute operations</span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-stone-900">A register that survives patchy networks</h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              Big imports, guest privacy and backup discipline are designed in from the first screen — not bolted on later.
            </p>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-[#f1e7df] bg-[#fffdfb] p-5 transition hover:border-brand-200 hover:bg-white hover:shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d={feature.icon} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h3 className="mt-4 text-base font-bold text-stone-900">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="access" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="card card-pad">
            <span className="eyebrow">{hasRoot ? "Administrator access" : "Get started"}</span>
            <h2 className="mt-4 text-2xl font-black tracking-tight text-stone-900">
              {hasRoot ? "Sign in to the registry" : "One-time root sign-up"}
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              {hasRoot
                ? "Administrators sign in with one email — personal or office. Any administrator can register or remove another administrator; the root admin is permanent."
                : "The registry has not been claimed yet. Complete the one-time root sign-up to create the permanent root administrator, then register your team from Settings."}
            </p>
            <ol className="mt-4 space-y-2 text-sm text-stone-600">
              <li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">1</span> Root signs up once — this account can never be removed.</li>
              <li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">2</span> Root (or any admin) registers other administrators with the same form.</li>
              <li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">3</span> Upload your Excel/CSV register — duplicates are ignored automatically.</li>
              <li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">4</span> Members search and view their record — no login needed.</li>
            </ol>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href={hasRoot ? "/login" : "/setup"} className="btn-primary">{hasRoot ? "Administrator sign in" : "Start root sign-up"}</Link>
              <Link href="/guest" className="btn-secondary">Search records</Link>
            </div>
          </div>
          <div className="space-y-4">
            <div className="card card-pad">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Membership health</p>
              <div className="mt-4 space-y-3">
                {[
                  { label: "Active", value: stats.active, tone: "bg-emerald-500" },
                  { label: "Pending", value: stats.pending, tone: "bg-amber-500" },
                  { label: "Expired", value: stats.expired, tone: "bg-rose-500" },
                ].map((row) => {
                  const pct = stats.total ? Math.round((row.value / stats.total) * 100) : 0;
                  return (
                    <div key={row.label}>
                      <div className="flex items-center justify-between text-xs font-medium text-stone-600">
                        <span>{row.label}</span>
                        <span>{numberFormat.format(row.value)} · {pct}%</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-stone-100">
                        <div className={`h-full rounded-full ${row.tone}`} style={{ width: `${Math.max(2, pct)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-xs text-stone-500">
                {numberFormat.format(stats.newThisMonth)} records added in the last 30 days · {numberFormat.format(stats.withEmail)} members with email on file.
              </p>
            </div>
            <div className="rounded-2xl bg-stone-900 p-5 text-white">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">Vault & portable backup</p>
              <p className="mt-2 text-sm text-stone-200">
                Snapshots are checksum-verified, downloadable as CSV/JSON and sized for a SanDisk or external drive mirror.
              </p>
              <div className="mt-3 flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs">
                <span>{vaultCount} snapshot{vaultCount === 1 ? "" : "s"} retained</span>
                <span className="font-semibold text-brand-300">{(vaultBytes / 1024 / 1024).toFixed(1)} MB</span>
              </div>
            </div>
          </div>
        </div>
      </section>

    </PublicShell>
  );
}
