export type NavItem = {
  href: string;
  label: string;
  /** Shorter label for the mobile bottom bar. */
  short: string;
  icon: string;
  /** Extra routes that should keep this item highlighted. */
  match?: string[];
  exact?: boolean;
};

const ICON = {
  home: "M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5M9.5 20v-6h5v6",
  records: "M5 4h9l5 5v11H5V4zm8 0v5h5M8 13h8M8 17h6",
  sync: "M4 12a8 8 0 0 1 13.7-5.7M20 12a8 8 0 0 1-13.7 5.7M17 3v4h-4M7 21v-4h4",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7.6 7.6 0 0 0-2-1.2L14.6 3h-4l-.4 2.6c-.7.3-1.4.7-2 1.2l-2.3-.9-2 3.4 2 1.5a7.4 7.4 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9c.6.5 1.3.9 2 1.2l.4 2.6h4l.4-2.6c.7-.3 1.4-.7 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z",
};

/** Guest / public navigation. */
export const PUBLIC_NAV: NavItem[] = [
  { href: "/", label: "Home", short: "Home", icon: ICON.home, exact: true },
  { href: "/guest", label: "Records", short: "Records", icon: ICON.records, match: ["/r"] },
  { href: "/sync", label: "Sync / Upload", short: "Sync", icon: ICON.sync },
  { href: "/settings", label: "Settings", short: "Settings", icon: ICON.settings },
];

/** Administrator navigation (same four menus, admin destinations). */
export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Home", short: "Home", icon: ICON.home, exact: true },
  { href: "/admin/records", label: "Records", short: "Records", icon: ICON.records },
  { href: "/admin/import", label: "Sync / Upload", short: "Sync", icon: ICON.sync, match: ["/admin/backups"] },
  { href: "/admin/settings", label: "Settings", short: "Settings", icon: ICON.settings },
];

export function isActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true;
  return (item.match ?? []).some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
