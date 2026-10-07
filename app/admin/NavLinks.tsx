"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Ruote", match: (p: string) => p === "/admin" || p.startsWith("/admin/ruote") },
  { href: "/admin/report", label: "Report vincite", match: (p: string) => p.startsWith("/admin/report") },
  { href: "/admin/tv", label: "Schermi TV", match: (p: string) => p.startsWith("/admin/tv") },
];

export default function AdminNavLinks() {
  const path = usePathname();
  return (
    <nav>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={l.match(path) ? "is-active" : ""}>{l.label}</Link>
      ))}
    </nav>
  );
}
