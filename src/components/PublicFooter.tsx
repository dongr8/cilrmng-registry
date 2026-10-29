import Link from "next/link";
import Brand from "@/components/Brand";
import { PUBLIC_NAV } from "@/components/nav-items";

export default function PublicFooter({ orgName, logoUrl, supportEmail }: { orgName: string; logoUrl: string; supportEmail: string }) {
  return (
    <footer className="no-print border-t border-[#f1e7df] bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-7 px-4 py-9 sm:px-6 sm:py-10 md:grid-cols-3">
        <div className="min-w-0">
          <Brand name={orgName} logoUrl={logoUrl} />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-stone-500">
            The official CILRMNG membership register — record lookup, certified A4 copies, offline access and vault backups.
          </p>
        </div>
        <div className="min-w-0 text-sm">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Menu</p>
          <ul className="space-y-2 text-stone-600">
            {PUBLIC_NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-brand-700">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/login" className="hover:text-brand-700">
                Administrator sign in
              </Link>
            </li>
            <li>
              <Link href="/preview" className="hover:text-brand-700">
                Mobile preview
              </Link>
            </li>
          </ul>
        </div>
        <div className="min-w-0 text-sm">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Support</p>
          <a href={`mailto:${supportEmail}`} className="link break-all">
            {supportEmail}
          </a>
          <p className="mt-3 text-xs leading-relaxed text-stone-500">
            Admins sign in with a personal or office email — both can be registered on one account. Guests need no login — view, print or download a
            record. Guest access is read-only.
          </p>
        </div>
      </div>
      <div className="border-t border-[#f6eee7] px-4 py-4 text-center text-xs text-stone-400">
        © {new Date().getFullYear()} {orgName}. Membership registry · Offline-first record keeping.
      </div>
    </footer>
  );
}
