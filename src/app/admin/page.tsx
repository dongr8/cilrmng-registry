import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, imports } from "@/db/schema";
import { getSessionAdmin, getSettings } from "@/lib/auth";
import { getRegisterStats } from "@/lib/members";
import { backupStats } from "@/lib/backups";
import OnlineTeam from "@/components/OnlineTeam";

export const dynamic = "force-dynamic";

const nf = new Intl.NumberFormat("en-US");

const STATUS_COLORS: Record<string, string> = {
  Active: "#10b981",
  Pending: "#f59e0b",
  Expired: "#f43f5e",
  Suspended: "#a8a29e",
  Deceased: "#57534e",
};

function formatBytes(bytes: number) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default async function DashboardPage() {
  const [admin, settings, stats, recentImports, audit, vault] = await Promise.all([
    getSessionAdmin(),
    getSettings(),
    getRegisterStats(),
    db.select().from(imports).orderBy(desc(imports.createdAt)).limit(5),
    db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(7),
    backupStats(),
  ]);

  const total = stats.total || 1;
  const capacity = Math.min(100, Math.round((stats.total / 100000) * 100));
  const maxCategory = Math.max(1, ...stats.byCategory.map((row) => row.value));
  const donutSegments = stats.byStatus.reduce<{ label: string; value: number; offset: number }[]>((acc, row) => {
    const previous = acc.length ? acc[acc.length - 1] : null;
    const offset = previous ? previous.offset + (previous.value / total) * 100 : 0;
    acc.push({ label: row.label, value: (row.value / total) * 100, offset });
    return acc;
  }, []);
  const gradient = donutSegments.length
    ? `conic-gradient(${donutSegments
        .map((segment) => `${STATUS_COLORS[segment.label] ?? "#ea580c"} ${segment.offset}% ${segment.offset + segment.value}%`)
        .join(", ")})`
    : "#f5f5f4";

  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const cards = [
    { label: "Total members", value: nf.format(stats.total), sub: `${nf.format(stats.newThisMonth)} added in 30 days`, accent: "text-brand-600" },
    { label: "Active memberships", value: nf.format(stats.active), sub: `${Math.round((stats.active / total) * 100)}% of register`, accent: "text-emerald-600" },
    { label: "Renewals overdue", value: nf.format(stats.expired), sub: `${nf.format(stats.pending)} pending approval`, accent: "text-amber-600" },
    { label: "Vault snapshots", value: nf.format(vault.count), sub: `${formatBytes(vault.bytes)} secured`, accent: "text-stone-700" },
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-600">{today}</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-stone-900 sm:text-[1.7rem]">
            Welcome back, {admin?.name.split(" ")[0] ?? "administrator"}
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            {settings.orgName} · membership dashboard
            {settings.autoBackup ? <span className="ml-2 badge bg-emerald-50 text-emerald-700 ring-emerald-200">Auto-backup on</span> : <span className="ml-2 badge bg-amber-50 text-amber-700 ring-amber-200">Auto-backup off</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/import" className="btn-primary text-xs sm:text-sm">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12m0 0l4-4m-4 4l-4-4M4 17v3h16v-3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Upload register
          </Link>
          <Link href="/admin/records" className="btn-secondary text-xs sm:text-sm">Browse records</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="card card-pad">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">{card.label}</p>
            <p className={`mt-1.5 text-2xl font-black tracking-tight sm:text-3xl ${card.accent}`}>{card.value}</p>
            <p className="mt-1 text-xs text-stone-500">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-4">
          <div className="card card-pad">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-stone-900">Membership grades</h2>
                <p className="text-xs text-stone-500">Derived from the registration number suffix (MICRM, SICRM, SILRM…)</p>
              </div>
              <Link href="/admin/records" className="text-xs font-semibold text-brand-700 hover:underline">View directory →</Link>
            </div>
            <div className="mt-5 space-y-3">
              {stats.byCategory.map((row) => (
                <div key={row.label}>
                  <div className="flex items-center justify-between text-xs font-medium text-stone-600">
                    <span>{row.label}</span>
                    <span>{nf.format(row.value)} · {Math.round((row.value / total) * 100)}%</span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-stone-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400" style={{ width: `${Math.max(2, (row.value / maxCategory) * 100)}%` }} />
                  </div>
                </div>
              ))}
              {stats.byCategory.length === 0 ? <p className="text-sm text-stone-500">No records imported yet.</p> : null}
            </div>
          </div>

          <div className="card card-pad">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-stone-900">Recent imports</h2>
                <p className="text-xs text-stone-500">Excel, CSV and pasted batches</p>
              </div>
              <Link href="/admin/import" className="text-xs font-semibold text-brand-700 hover:underline">New import →</Link>
            </div>
            <div className="mt-3 -mx-2 overflow-x-auto scroll-thin">
              <table className="w-full min-w-[560px] border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="th">File</th>
                    <th className="th">Rows</th>
                    <th className="th">Outcome</th>
                    <th className="th">By</th>
                    <th className="th">When</th>
                  </tr>
                </thead>
                <tbody>
                  {recentImports.map((row) => (
                    <tr key={row.id} className="hover:bg-brand-50/40">
                      <td className="td max-w-[220px] truncate font-medium text-stone-800">{row.fileName}</td>
                      <td className="td">{nf.format(row.rowsTotal)}</td>
                      <td className="td">
                        <span className="badge bg-emerald-50 text-emerald-700 ring-emerald-200">{row.rowsImported} new</span>
                        {row.rowsUpdated ? <span className="ml-1 badge bg-brand-50 text-brand-700 ring-brand-200">{row.rowsUpdated} upd</span> : null}
                        {row.rowsSkipped ? <span className="ml-1 badge bg-stone-100 text-stone-600 ring-stone-200">{row.rowsSkipped} skip</span> : null}
                      </td>
                      <td className="td text-xs text-stone-500">{row.createdByName ?? "—"}</td>
                      <td className="td text-xs text-stone-500">{new Date(row.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</td>
                    </tr>
                  ))}
                  {recentImports.length === 0 ? (
                    <tr><td className="td text-stone-500" colSpan={5}>No imports yet — upload your first Excel or CSV register.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card card-pad">
            <h2 className="text-base font-bold text-stone-900">Status mix</h2>
            <div className="mt-4 flex items-center gap-5">
              <div className="relative h-28 w-28 shrink-0 rounded-full" style={{ background: gradient }}>
                <div className="absolute inset-[14px] flex flex-col items-center justify-center rounded-full bg-white">
                  <span className="text-lg font-black text-stone-900">{nf.format(stats.total)}</span>
                  <span className="text-[10px] uppercase tracking-wide text-stone-400">members</span>
                </div>
              </div>
              <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
                {stats.byStatus.map((row) => (
                  <li key={row.label} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 truncate text-stone-600">
                      <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLORS[row.label] ?? "#ea580c" }} />
                      {row.label}
                    </span>
                    <span className="font-semibold text-stone-800">{nf.format(row.value)}</span>
                  </li>
                ))}
                {stats.byStatus.length === 0 ? <li className="text-stone-400">Awaiting data</li> : null}
              </ul>
            </div>
          </div>

          <OnlineTeam />

          <div className="rounded-2xl bg-stone-900 p-5 text-white">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-300">Register capacity</p>
              <span className="text-xs font-bold text-brand-300">{nf.format(Math.max(stats.total, 1))} / 100,000</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(2, capacity)}%` }} />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-stone-300">
              Imports stream in batches of 500 rows; the register mirrors your 7-column sheet and supports up to 20 columns per member.
            </p>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs">
              <span>Latest snapshot</span>
              <span className="font-semibold text-white">
                {vault.latestAt ? new Date(vault.latestAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "none yet"}
              </span>
            </div>
            <Link href="/admin/backups" className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-500">
              Open backup vault
            </Link>
          </div>

          <div className="card card-pad">
            <h2 className="text-base font-bold text-stone-900">Record completeness</h2>
            <div className="mt-3 space-y-3">
              {[
                { label: "E-mail on file", value: stats.withEmail },
                { label: "Tel. No on file", value: stats.withPhone },
                { label: "Contact address", value: stats.withAddress },
              ].map((row) => {
                const pct = Math.round((row.value / total) * 100);
                return (
                  <div key={row.label}>
                    <div className="flex items-center justify-between text-xs text-stone-600">
                      <span>{row.label}</span>
                      <span className="font-semibold">{pct}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(2, pct)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-stone-900">Activity trail</h2>
            <p className="text-xs text-stone-500">Every import, edit and admin change is logged</p>
          </div>
          <Link href="/admin/settings" className="text-xs font-semibold text-brand-700 hover:underline">Full audit log →</Link>
        </div>
        <ul className="mt-4 divide-y divide-stone-100">
          {audit.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-stone-800">{row.action}</p>
                <p className="truncate text-xs text-stone-500">{row.detail || "—"}</p>
              </div>
              <div className="text-right text-[11px] text-stone-400">
                <p className="font-semibold text-stone-600">{row.actorName}</p>
                <p>{new Date(row.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </li>
          ))}
          {audit.length === 0 ? <li className="py-3 text-sm text-stone-500">No activity yet.</li> : null}
        </ul>
      </div>
    </div>
  );
}
